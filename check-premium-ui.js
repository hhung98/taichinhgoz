const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');

const checks = [
  {
    name: 'premium fintech design tokens exist',
    pass: [
      '--surface-panel',
      '--surface-elevated',
      '--accent-money',
      '--radius-card',
      '--font-size-metric'
    ].every(token => css.includes(token))
  },
  {
    name: 'header uses compact premium shell and SVG icons',
    pass: html.includes('GOZ Finance') &&
      html.includes('header-actions') &&
      html.includes('icon-svg') &&
      !/class="logo"[^>]*>[^<]*[\u{1F300}-\u{1FAFF}]/u.test(html)
  },
  {
    name: 'exchange bar uses compact fintech layout',
    pass: html.includes('exchange-shell') &&
      html.includes('exchange-rates') &&
      html.includes('converter-card') &&
      css.includes('.exchange-shell')
  },
  {
    name: 'summary cards use SVG icons and premium KPI structure',
    pass: (html.match(/class="summary-card/g) || []).length >= 6 &&
      (html.match(/class="card-icon"/g) || []).length >= 6 &&
      (html.match(/data-lucide="/g) || []).length >= 12 &&
      html.includes('metric-card-content')
  },
  {
    name: 'savings goals use refined form/list and no emoji-rendered goal rows',
    pass: html.includes('goal-field') &&
      html.includes('goal-add-btn') &&
      app.includes('goal-meta') &&
      !app.includes('<div class="goal-name">🎯') &&
      !app.includes('title="Xóa">🗑')
  },
  {
    name: 'mobile responsive rules are upgraded',
    pass: css.includes('@media(max-width:720px)') &&
      css.includes('.header-actions') &&
      css.includes('.exchange-rates') &&
      css.includes('.goal-form')
  },
  {
    name: 'visible UI source is free of emoji icons',
    pass: !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html + app)
  },
  {
    name: 'light theme has premium token overrides and light body surface',
    pass: css.includes('[data-theme="light"] {') &&
      css.includes('--surface-panel: #ffffff') &&
      css.includes('[data-theme="light"] body') &&
      css.includes('html[data-theme="light"] body') &&
      css.includes('#eef3f7 !important')
  },
  {
    name: 'budget overview uses exact monthly line chart with Vietnamese accents',
    pass: app.includes('budget-flow-chart') &&
      app.includes('budgetFlowPath') &&
      app.includes('Thu nhập') &&
      app.includes('Chi tiêu') &&
      app.includes('Còn lại') &&
      app.includes('Sinh hoạt 40%') &&
      app.includes('Dự phòng 40%') &&
      app.includes('Đầu tư 20%') &&
      !app.includes('budget-monthly-bar-chart')
  },
  {
    name: 'allocation section uses column/bar chart instead of pie chart',
    pass: app.includes('drawAllocationBars') &&
      app.includes('allocation-bar-chart') &&
      app.includes('Chi tiêu') &&
      app.includes('Dự phòng') &&
      app.includes('Đầu tư') &&
      css.includes('.allocation-bar-chart') &&
      css.includes('.allocation-bar-fill')
  },
  {
    name: 'converter result is placed on its own row to prevent overlap',
    pass: css.includes('.converter-result') &&
      css.includes('grid-column: 1 / -1') &&
      css.includes('overflow-wrap: anywhere')
  },
  {
    name: 'desktop savings goal form keeps controls on one row',
    pass: css.includes('grid-template-columns: minmax(240px, 1.15fr) minmax(220px, 1fr) minmax(132px, 0.55fr) minmax(112px, auto)') &&
      css.includes('.goal-add-btn') &&
      css.includes('min-width: 112px')
  },
  {
    name: 'scroll reveal and premium card hover are configured',
    pass: app.includes('function initScrollReveal') &&
      app.includes('const REVEAL_MAX_DELAY = 120') &&
      app.includes('const REVEAL_STAGGER = 35') &&
      app.includes('threshold: 0.08') &&
      app.includes("rootMargin: '0px 0px 8% 0px'") &&
      !app.includes('index * 80') &&
      css.includes('.reveal-box') &&
      css.includes('transition-duration: 0.28s') &&
      css.includes('translateY(8px)') &&
      css.includes('cubic-bezier(0.16, 1, 0.3, 1)') &&
      css.includes('transition-duration: 0.18s !important') &&
      css.includes('.premium-card-hover:hover')
  },
  {
    name: 'chart has premium hover tooltip',
    pass: app.includes('function showBudgetTooltip') &&
      app.includes('budget-chart-tooltip') &&
      app.includes('budget-flow-hit') &&
      css.includes('.budget-chart-tooltip') &&
      css.includes('.budget-flow-hit')
  },
  {
    name: 'financial insight card is rendered from budget data',
    pass: html.includes('financialInsightCard') &&
      html.includes('financialInsightTitle') &&
      app.includes('function renderFinancialInsight') &&
      app.includes('financial-insight-card') &&
      css.includes('.financial-insight-card')
  },
  {
    name: 'mobile bottom navigation exists',
    pass: html.includes('mobileBottomNav') &&
      html.includes('href="#budgetSection"') &&
      html.includes('href="#savingsGoalPanel"') &&
      css.includes('.mobile-bottom-nav') &&
      css.includes('padding-bottom: calc(28px + 74px)')
  },
  {
    name: 'mobile header controls are aligned and compact',
    pass: css.includes('grid-template-columns: 44px 44px minmax(0, 1fr)') &&
      css.includes('.user-badge .pin-toggle-wrapper') &&
      css.includes('margin-left: auto') &&
      css.includes('.user-badge .user-info-column') &&
      css.includes('.user-badge .user-name') &&
      css.includes('display: block') &&
      css.includes('.user-name:empty::after') &&
      css.includes('.date-badge span')
  },
  {
    name: 'health card uses circular progress treatment',
    pass: app.includes('--health-progress') &&
      app.includes('--health-color') &&
      css.includes('.health-score-ring') &&
      css.includes('conic-gradient')
  },
  {
    name: 'budget table uses minimalist SaaS row styling',
    pass: css.includes('.monthly-table tbody tr:hover') &&
      css.includes('border-left: 0') &&
      css.includes('font-variant-numeric: tabular-nums') &&
      css.includes('.monthly-table td:nth-child(n+2)')
  },
  {
    name: 'demo budget data scaffold is available without overwriting real data',
    pass: app.includes('DEMO_MONTHLY_BUDGET') &&
      app.includes('function getDemoBudgetData') &&
      app.includes('applyDemoBudgetIfEmpty')
  },
  {
    name: 'mobile density has compact KPI grid and chart sizing',
    pass: css.includes('@media(max-width:480px)') &&
      css.includes('.summary-card.compact-mobile') &&
      css.includes('.budget-chart-container') &&
      css.includes('min-height: 260px')
  }
];

const failed = checks.filter(check => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
}

if (failed.length) {
  process.exitCode = 1;
}
