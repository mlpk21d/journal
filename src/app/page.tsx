import Link from 'next/link';
export default function Home() {
 return <main className="shell"><header><span className="brand">TRADE / JOURNAL</span><span className="muted">Read-only brokerage analytics</span></header>
 <section className="hero"><p className="eyebrow">TRADING INTELLIGENCE</p><h1>Know every trade.<br/><span>Understand every outcome.</span></h1>
 <p className="intro">A private workspace for executions, fees, performance, and wash sale monitoring. Connect Webull when your server is configured.</p>
 <div className="pill-row"><span>Next.js + TypeScript</span><span>PostgreSQL</span><span>Webull OpenAPI</span></div></section>
 <section className="tiles"><article><small>01 / IMPORT</small><h2>Webull trades</h2><p>Retrieve historical orders and inspect execution details through authenticated, read-only API routes.</p></article>
 <article><small>02 / ACCOUNTING</small><h2>Accurate records</h2><p>Keep fills, per-transaction fees, broker identifiers and source payloads for reliable reconciliation.</p></article>
 <article><small>03 / TAX AWARENESS</small><h2>Wash sale readiness</h2><p>Schema foundations for tax lots, replacement-share matching and cost-basis adjustments.</p></article></section>
 <footer><span>Foundation build · No orders placed by this application</span><Link href="https://developer.webull.com/apis/docs/">Webull API docs ↗</Link></footer></main>;
}
