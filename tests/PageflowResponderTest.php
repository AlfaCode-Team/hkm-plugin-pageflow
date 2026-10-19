<?php

declare(strict_types=1);

namespace Tests\Unit\Plugins\Pageflow;

use AlfacodeTeam\PhpServicePlatform\Kernel\Container\CoreContainer;
use AlfacodeTeam\PhpServicePlatform\Kernel\Container\ModuleContainer;
use AlfacodeTeam\PhpServicePlatform\Kernel\Http\Request;
use AlfacodeTeam\PhpServicePlatform\Kernel\Http\Response;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Plugins\Pageflow\API\Contracts\PageflowSharerContract;
use Plugins\Pageflow\Http\CallablePageflowSharer;
use Plugins\Pageflow\Http\CompositePageflowSharer;
use Plugins\Pageflow\Http\PageflowPage;
use Plugins\Pageflow\Http\PageflowResponder;
use Plugins\Pageflow\Http\PageflowShares;
use Plugins\Pageflow\Http\RegistryPageflowSharer;
use Plugins\Pageflow\Http\PageflowStage;

#[CoversClass(PageflowResponder::class)]
#[CoversClass(PageflowPage::class)]
#[CoversClass(PageflowStage::class)]
final class PageflowResponderTest extends TestCase
{
    private ?string $layoutPath = null;

    protected function tearDown(): void
    {
        if ($this->layoutPath !== null && is_file($this->layoutPath)) {
            @unlink($this->layoutPath);
        }
        parent::tearDown();
    }

    private function responder(): PageflowResponder
    {
        // A PHP layout template rendered via ob_start with $FLOW_PAGE in scope.
        $this->layoutPath = tempnam(sys_get_temp_dir(), 'pf_') . '.php';
        file_put_contents(
            $this->layoutPath,
            '<html><body><div id="app"></div><?= $FLOW_PAGE->renderScript() ?></body></html>',
        );

        return new PageflowResponder(version: 'v1', layoutPath: $this->layoutPath, appId: 'app');
    }

    /** @param array<string,string> $headers */
    private function request(array $headers = [], string $method = 'GET', string $path = '/users'): Request
    {
        return Request::build(method: $method, path: $path, headers: $headers);
    }

    public function test_full_load_boots_client_from_window_initial_page(): void
    {
        $body = $this->responder()->render($this->request(), 'Users/Index', 'admin', ['users' => [['id' => 1]]])->body();

        $this->assertStringContainsString('window.initialPage =', $body);
        $this->assertStringContainsString('Users/Index', $body);
        $this->assertStringContainsString('<html>', $body);
    }

    public function test_accept_json_is_treated_as_pageflow_request(): void
    {
        $response = $this->responder()->render(
            $this->request(['Accept' => 'application/json']),
            'Users/Index', 'admin',
            ['a' => 1],
        );

        $this->assertSame('true', $response->headers()['X-Pageflow'] ?? null);
    }

    public function test_shared_data_is_merged_into_every_page(): void
    {
        $responder = $this->responder();
        $responder->share('auth', ['id' => 7]);

        $response = $responder->render($this->request(['X-Pageflow' => 'true']), 'Users/Index', 'admin', ['a' => 1]);
        $props = json_decode($response->body(), true)['props'];

        $this->assertSame(['id' => 7], $props['auth']);
        $this->assertSame(1, $props['a']);
    }

    public function test_page_props_override_shared_data(): void
    {
        $responder = $this->responder();
        $responder->mergeShared(['flash' => 'old']);

        $response = $responder->render($this->request(['X-Pageflow' => 'true']), 'Users/Index', 'admin', ['flash' => 'new']);

        $this->assertSame('new', json_decode($response->body(), true)['props']['flash']);
    }

    public function test_partial_navigation_rewrites_url_and_component_from_headers(): void
    {
        $response = $this->responder()->render(
            $this->request([
                'X-Pageflow'      => 'true',
                'X-Pageflow-Url'  => 'https://example.com/dashboard?tab=1',
                'X-Pageflow-Page' => 'Dashboard/Home',
            ]),
            'Users/Index', 'admin',
            ['a' => 1],
            loadPage: false,
        );
        $page = json_decode($response->body(), true);

        $this->assertSame('Dashboard/Home', $page['component']);
        $this->assertSame('/dashboard', $page['url']);
    }

    public function test_xhr_request_returns_json_page_object(): void
    {
        $response = $this->responder()->render($this->request(['X-Pageflow' => 'true']), 'Users/Index', 'admin', ['users' => [1, 2]]);
        $page = json_decode($response->body(), true);

        $this->assertSame('Users/Index', $page['component']);
        $this->assertSame('/users', $page['url']);
        $this->assertSame('v1', $page['version']);
        $this->assertSame('true', $response->headers()['X-Pageflow'] ?? null);
    }

    public function test_partial_reload_returns_only_requested_props(): void
    {
        $response = $this->responder()->render(
            $this->request([
                'X-Pageflow' => 'true',
                'X-Pageflow-Partial-Data' => 'a,b',
                'X-Pageflow-Partial-Component' => 'Users/Index',
            ]),
            'Users/Index', 'admin',
            ['a' => 1, 'b' => 2, 'c' => 3],
        );

        $this->assertSame(['a' => 1, 'b' => 2], (array) json_decode($response->body(), true)['props']);
    }

    public function test_a_closure_prop_is_called_and_sent_as_its_value(): void
    {
        $response = $this->responder()->render(
            $this->request(['X-Pageflow' => 'true']),
            'Users/Index', 'admin',
            ['a' => static fn (): array => ['n' => 1], 'b' => 2],
        );

        $this->assertSame(['a' => ['n' => 1], 'b' => 2], json_decode($response->body(), true)['props']);
    }

    public function test_a_partial_reload_never_calls_a_lazy_prop_it_leaves_out(): void
    {
        $called = [];
        $response = $this->responder()->render(
            $this->request([
                'X-Pageflow' => 'true',
                'X-Pageflow-Partial-Data' => 'a',
                'X-Pageflow-Partial-Component' => 'Users/Index',
            ]),
            'Users/Index', 'admin',
            [
                'a' => static function () use (&$called): int { $called[] = 'a'; return 1; },
                'b' => static function () use (&$called): int { $called[] = 'b'; return 2; },
            ],
        );

        $this->assertSame(['a' => 1], (array) json_decode($response->body(), true)['props']);
        $this->assertSame(['a'], $called, 'the left-out prop was never computed');
    }

    public function test_a_full_page_load_calls_every_lazy_prop(): void
    {
        $response = $this->responder()->render($this->request(), 'Users/Index', 'admin', ['a' => static fn (): int => 7]);

        $this->assertStringContainsString('"props":{"a":7}', $response->body());
    }

    public function test_partial_reload_except_drops_named_props(): void
    {
        $response = $this->responder()->render(
            $this->request([
                'X-Pageflow' => 'true',
                'X-Pageflow-Partial-Except' => 'c',
                'X-Pageflow-Partial-Component' => 'Users/Index',
            ]),
            'Users/Index', 'admin',
            ['a' => 1, 'b' => 2, 'c' => 3],
        );

        $this->assertSame(['a' => 1, 'b' => 2], (array) json_decode($response->body(), true)['props']);
    }

    public function test_partial_rules_ignored_when_component_differs(): void
    {
        $response = $this->responder()->render(
            $this->request([
                'X-Pageflow' => 'true',
                'X-Pageflow-Partial-Data' => 'a',
                'X-Pageflow-Partial-Component' => 'Other',
            ]),
            'Users/Index', 'admin',
            ['a' => 1, 'b' => 2],
        );

        $this->assertSame(['a' => 1, 'b' => 2], (array) json_decode($response->body(), true)['props']);
    }

    public function test_version_stage_returns_409_for_stale_client_version(): void
    {
        putenv('PAGEFLOW_VERSION=v2');
        $stage = new PageflowStage();
        $next = static fn(Request $r) => \AlfacodeTeam\PhpServicePlatform\Kernel\Http\Response::text('OK');

        $response = $stage->handle(
            $this->request(['X-Pageflow' => 'true', 'X-Pageflow-Version' => 'v1']),
            $next,
        );

        $this->assertSame(409, $response->status());
        $this->assertSame('/users', $response->headers()['X-Pageflow-Location'] ?? null);
        putenv('PAGEFLOW_VERSION');
    }

    public function test_version_stage_passes_matching_version_through(): void
    {
        putenv('PAGEFLOW_VERSION=v2');
        $stage = new PageflowStage();
        $next = static fn(Request $r) => \AlfacodeTeam\PhpServicePlatform\Kernel\Http\Response::text('OK');

        $response = $stage->handle(
            $this->request(['X-Pageflow' => 'true', 'X-Pageflow-Version' => 'v2']),
            $next,
        );

        $this->assertSame('OK', $response->body());
        putenv('PAGEFLOW_VERSION');
    }

    public function test_share_stage_invokes_bound_sharer_on_the_responder(): void
    {
        $core = new CoreContainer();
        $container = new ModuleContainer($core);
        $container->setScope('http.pageflow');

        $responder = $this->responder();
        $container->instance(PageflowResponder::class, $responder);
        $container->instance(PageflowSharerContract::class, new class implements PageflowSharerContract {
            public function share(Request $request, PageflowResponder $responder): void
            {
                $responder->share('auth', ['id' => 42]);
            }
        });

        $request = $this->request(['X-Pageflow' => 'true'])->withContainer($container);
        $reached = false;
        (new PageflowStage())->handle($request, static function (Request $r) use (&$reached) {
            $reached = true;
            return Response::text('OK');
        });

        $this->assertTrue($reached);
        $props = json_decode($responder->render($request, 'Users/Index', 'admin', [])->body(), true)['props'];
        $this->assertSame(['id' => 42], $props['auth']);
    }

    public function test_composite_runs_all_contributors_last_wins_on_collision(): void
    {
        $responder = $this->responder();
        $sharer = new CompositePageflowSharer(
            new CallablePageflowSharer(static function (Request $r, PageflowResponder $p): void {
                $p->mergeShared(['appName' => 'HKM', 'flash' => 'old']);
            }),
        );
        $sharer->add(new CallablePageflowSharer(static function (Request $r, PageflowResponder $p): void {
            $p->share('cartCount', 3);
            $p->share('flash', 'new'); // later contributor wins
        }));

        $request = $this->request(['X-Pageflow' => 'true']);
        $sharer->share($request, $responder);
        $props = json_decode($responder->render($request, 'Users/Index', 'admin', [])->body(), true)['props'];

        $this->assertSame('HKM', $props['appName']);
        $this->assertSame(3, $props['cartCount']);
        $this->assertSame('new', $props['flash']);
    }

    public function test_pageflow_share_helper_registers_keyed_and_raw_contributors(): void
    {
        PageflowShares::flush();
        pageflow_share('year', static fn(Request $r): string => '2026');
        pageflow_share(static function (Request $r, PageflowResponder $p): void {
            $p->mergeShared(['appName' => 'HKM', 'path' => $r->path()]);
        });

        $responder = $this->responder();
        $request = $this->request(['X-Pageflow' => 'true'], path: '/blog');
        (new RegistryPageflowSharer())->share($request, $responder);
        $props = json_decode($responder->render($request, 'Blog/Index', 'admin', [])->body(), true)['props'];

        $this->assertSame('2026', $props['year']);
        $this->assertSame('HKM', $props['appName']);
        $this->assertSame('/blog', $props['path']);
        PageflowShares::flush();
    }

    public function test_pageflow_share_rejects_a_key_without_a_resolver(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        pageflow_share('auth');
    }

    public function test_share_stage_passes_through_without_a_container(): void
    {
        $response = (new PageflowStage())->handle(
            $this->request(),
            static fn(Request $r) => Response::text('OK'),
        );

        $this->assertSame('OK', $response->body());
    }

    // ── 5. Off-origin redirect → client-side full page load ──────────────────

    /** Run the stage on a Pageflow visit to https://app.example.test/users whose controller redirects. */
    private function redirectedVisit(string $location, bool $pageflow = true): \AlfacodeTeam\PhpServicePlatform\Kernel\Http\Response
    {
        $request = Request::build(
            method: 'GET',
            path: '/users',
            headers: $pageflow ? ['X-Pageflow' => 'true', 'Host' => 'app.example.test'] : ['Host' => 'app.example.test'],
            server: ['HTTPS' => 'on', 'HTTP_HOST' => 'app.example.test', 'SERVER_PORT' => 443],
        );

        return (new PageflowStage())->handle(
            $request,
            static fn(Request $r) => \AlfacodeTeam\PhpServicePlatform\Kernel\Http\Response::redirect($location),
        );
    }

    public function test_a_redirect_to_another_host_becomes_a_full_page_load(): void
    {
        $response = $this->redirectedVisit('https://organizer.example.test/');

        $this->assertSame(409, $response->status());
        $this->assertSame('https://organizer.example.test/', $response->headers()['X-Pageflow-Location'] ?? null);
    }

    public function test_a_redirect_to_another_scheme_or_port_is_another_origin(): void
    {
        $this->assertSame(409, $this->redirectedVisit('http://app.example.test/login')->status());
        $this->assertSame(409, $this->redirectedVisit('https://app.example.test:8443/login')->status());
    }

    public function test_a_same_origin_redirect_is_left_for_the_xhr_to_follow(): void
    {
        $this->assertSame(302, $this->redirectedVisit('/login')->status());
        $this->assertSame(302, $this->redirectedVisit('https://app.example.test/login')->status());
        $this->assertSame(302, $this->redirectedVisit('https://APP.example.test:443/login')->status());
    }

    public function test_an_ordinary_request_keeps_its_redirect(): void
    {
        $this->assertSame(302, $this->redirectedVisit('https://organizer.example.test/', pageflow: false)->status());
    }

    public static function setUpBeforeClass(): void
    {
        // The stock layout calls vite(); give ViteManifest a throwaway build.
        $dir = sys_get_temp_dir() . '/pf_vite_' . bin2hex(random_bytes(4));
        mkdir($dir . '/build', 0777, true);
        file_put_contents($dir . '/build/manifest-admin.json', json_encode([
            'src/surfaces/admin/index.tsx' => ['file' => 'assets/app.js', 'isEntry' => true],
        ]));
        $_ENV['VITE_PUBLIC_PATH'] = $dir;
    }

    private function stockResponder(string $cspHeader = ''): PageflowResponder
    {
        return new PageflowResponder(
            version: 'v1',
            layoutPath: dirname(__DIR__) . '/resources/layouts/app.php',
            appId: 'app',
            cspHeader: $cspHeader,
        );
    }

    public function test_no_nonce_leaves_output_without_nonce_and_without_csp_header(): void
    {
        $res = $this->stockResponder()->render($this->request(), 'Users/Index', 'admin');

        $this->assertStringNotContainsString('nonce', $res->body());
        $this->assertStringContainsString('<script>window.initialPage =', $res->body());
        $this->assertNull(($res->headers()['Content-Security-Policy'] ?? null));
    }

    public function test_request_nonce_is_stamped_on_every_inline_script_and_escaped(): void
    {
        $req = $this->request()->withAttribute('csp_nonce', 'abcdEFGH12345678==');
        $body = $this->stockResponder()->render($req, 'Users/Index', 'admin')->body();

        $this->assertStringContainsString('<script nonce="abcdEFGH12345678==">window.initialPage =', $body);
        // every <script ...> without src carries the nonce
        preg_match_all('/<script\b(?![^>]*\bsrc=)[^>]*>/', $body, $m);
        $this->assertNotEmpty($m[0]);
        foreach ($m[0] as $tag) {
            $this->assertStringContainsString('nonce="abcdEFGH12345678=="', $tag);
        }
    }

    public function test_page_render_script_escapes_the_nonce(): void
    {
        $page = new PageflowPage('A', [], '/', 'v1');
        $this->assertStringStartsWith('<script nonce="a&quot;b">', $page->renderScript('a"b'));
        $this->assertStringStartsWith('<script>', $page->renderScript());
    }

    public function test_page_render_script_cannot_be_closed_by_a_prop(): void
    {
        $page = new PageflowPage('A', ['bio' => '</script><script>alert(1)</script> & co'], '/', 'v1');
        $html = $page->renderScript();

        // Exactly one element: the prop's "</script>" never reaches the HTML parser.
        $this->assertSame(1, substr_count($html, '</script>'));
        $this->assertStringContainsString('</script>', $html);

        // And the value is unchanged once the JSON is parsed back.
        $json = substr($html, strlen('<script>window.initialPage = '), -strlen(';</script>'));
        $this->assertSame('</script><script>alert(1)</script> & co', json_decode($json, true)['props']['bio']);
    }

    public function test_configured_header_mints_nonce_and_matches_the_layout(): void
    {
        $res = $this->stockResponder("script-src 'self' 'nonce-{nonce}'")
            ->render($this->request(), 'Users/Index', 'admin');

        $csp = (string) ($res->headers()['Content-Security-Policy'] ?? null);
        $this->assertSame(1, preg_match("/'nonce-([A-Za-z0-9+\/=]{24})'/", $csp, $m));
        $this->assertStringContainsString('<script nonce="' . $m[1] . '">', $res->body());
    }

    public function test_configured_header_reuses_the_app_nonce(): void
    {
        $req = $this->request()->withAttribute('csp_nonce', 'abcdEFGH12345678==');
        $res = $this->stockResponder("script-src 'nonce-{nonce}'")->render($req, 'X', 'admin');

        $this->assertSame("script-src 'nonce-abcdEFGH12345678=='", ($res->headers()['Content-Security-Policy'] ?? null));
    }

    public function test_invalid_nonce_attribute_is_ignored(): void
    {
        $req = $this->request()->withAttribute('csp_nonce', "x\r\nSet-Cookie: a");
        $res = $this->stockResponder("script-src 'nonce-{nonce}'")->render($req, 'X', 'admin');

        $this->assertStringNotContainsString('Set-Cookie', (string) ($res->headers()['Content-Security-Policy'] ?? null));
    }

    public function test_json_response_is_unaffected_by_nonce(): void
    {
        $req = $this->request(['X-Pageflow' => 'true'])->withAttribute('csp_nonce', 'abcdEFGH12345678==');
        $res = $this->stockResponder("script-src 'nonce-{nonce}'")->render($req, 'X', 'admin');

        $this->assertNull(($res->headers()['Content-Security-Policy'] ?? null));
        $this->assertStringNotContainsString('abcdEFGH', $res->body());
    }
}
