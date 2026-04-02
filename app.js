// ===== State =====
let monthlyBudget = {};
let savingsGoals = [];
let budgetYear = new Date().getFullYear();
let exchangeRate = null;
let usdRate = null;
let exchangeStatus = 'loading';
let isDark = localStorage.getItem('theme') !== 'light';
let isSignUpMode = false;
let saveTimeout = null;

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

// ===== Init =====
function init() {
    applyTheme();
    initSupabase();
    onAuthStateChange(handleAuthChange);
    checkSession();
}

async function checkSession() {
    try {
        const session = await getSession();
        if (session) {
            currentUser = session.user;
            await showApp();
        } else {
            showAuth();
        }
    } catch (e) {
        console.error('Session check error:', e);
        showAuth();
    }
}

async function handleAuthChange(event, session) {
    if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        await showApp();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        showAuth();
    }
}

async function showApp() {
    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('loadingOverlay').style.display = 'flex';
    document.getElementById('appWrapper').style.display = 'block';

    // Update user badge
    try {
        const profile = await getProfile();
        const name = profile?.full_name || currentUser.email?.split('@')[0] || 'User';
        document.getElementById('userName').textContent = name;
    } catch (e) {
        document.getElementById('userName').textContent = currentUser.email?.split('@')[0] || 'User';
    }

    // Load data from Supabase
    try {
        monthlyBudget = await loadBudgets();
        savingsGoals = await loadGoals();
    } catch (e) {
        console.error('Load data error:', e);
        showToast('Lỗi tải dữ liệu: ' + e.message, 'error');
        monthlyBudget = {};
        savingsGoals = [];
    }

    document.getElementById('loadingOverlay').style.display = 'none';
    setDefaultDate();
    renderAll();
    fetchExchangeRate();
    setInterval(fetchExchangeRate, 1980000);
    registerSW();
}

function showAuth() {
    document.getElementById('authOverlay').style.display = 'flex';
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'none';
    document.getElementById('authError').textContent = '';
}

// ===== Auth Handlers =====
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const btn = document.getElementById('authSubmitBtn');
    const errorEl = document.getElementById('authError');
    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = '⏳ Đang xử lý...';

    try {
        if (isSignUpMode) {
            const fullName = document.getElementById('authName').value.trim();
            const data = await signUpWithEmail(email, password, fullName);
            if (data.user && !data.session) {
                errorEl.style.color = 'var(--accent-green)';
                errorEl.textContent = '✅ Đăng ký thành công! Kiểm tra email để xác nhận.';
            }
        } else {
            await signInWithEmail(email, password);
        }
    } catch (err) {
        errorEl.style.color = 'var(--accent-red)';
        if (err.message.includes('Invalid login credentials')) {
            errorEl.textContent = '❌ Email hoặc mật khẩu không đúng.';
        } else if (err.message.includes('User already registered')) {
            errorEl.textContent = '❌ Email đã được đăng ký. Hãy đăng nhập.';
        } else if (err.message.includes('Email not confirmed')) {
            errorEl.textContent = '⚠️ Vui lòng xác nhận email trước khi đăng nhập.';
        } else {
            errorEl.textContent = '❌ ' + err.message;
        }
    } finally {
        btn.disabled = false;
        btn.textContent = isSignUpMode ? '📝 Đăng ký' : '🔑 Đăng nhập';
    }
}

async function handleGoogleLogin() {
    try {
        await signInWithGoogle();
    } catch (err) {
        document.getElementById('authError').textContent = '❌ ' + err.message;
    }
}

async function handleLogout() {
    try {
        await signOut();
        monthlyBudget = {};
        savingsGoals = [];
        showAuth();
        showToast('👋 Đã đăng xuất', 'info');
    } catch (err) {
        showToast('Lỗi đăng xuất: ' + err.message, 'error');
    }
}

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    document.getElementById('nameField').style.display = isSignUpMode ? 'block' : 'none';
    document.getElementById('authSubmitBtn').textContent = isSignUpMode ? '📝 Đăng ký' : '🔑 Đăng nhập';
    document.getElementById('authToggleText').textContent = isSignUpMode ? 'Đã có tài khoản?' : 'Chưa có tài khoản?';
    document.getElementById('authToggleBtn').textContent = isSignUpMode ? 'Đăng nhập' : 'Đăng ký';
    document.getElementById('authError').textContent = '';
}

// ===== Theme =====
function applyTheme() {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = isDark ? '🌙' : '☀️';
    const meta = document.getElementById('metaThemeColor');
    if (meta) meta.content = isDark ? '#0f0f1a' : '#f0f2f5';
}

function toggleTheme() {
    isDark = !isDark;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    applyTheme();
}

function setDefaultDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = '📅 ' + new Date().toLocaleDateString('vi-VN', options);
}

// ===== Exchange Rate =====
const TWELVE_DATA_KEY = '56064eb9612446bcb827e837eb814e24';

function updateRateUI(widget, statusEl, usdWidget, usdSubtext, statusLabel) {
    widget.textContent = exchangeRate.toFixed(2) + ' ₫';
    statusEl.innerHTML = '<span class="pulse-dot"></span> ' + statusLabel;
    statusEl.className = 'exchange-status live';
    document.getElementById('exchangeSubtext').textContent = '1 KRW = ' + exchangeRate.toFixed(2) + ' VND';
    if (usdWidget) usdWidget.textContent = fmtFull(Math.round(usdRate)) + ' ₫';
    if (usdSubtext) usdSubtext.textContent = '1 USD = ' + fmtFull(Math.round(usdRate)) + ' VND';
    renderSummary();
}

async function fetchExchangeRate() {
    const widget = document.getElementById('exchangeRateValue');
    const statusEl = document.getElementById('exchangeStatus');
    const usdWidget = document.getElementById('usdRateValue');
    const usdSubtext = document.getElementById('usdSubtext');

    // Source 1: Twelve Data (realtime, limited credits)
    try {
        const [krwRes, usdRes] = await Promise.all([
            fetch(`https://api.twelvedata.com/exchange_rate?symbol=KRW/VND&apikey=${TWELVE_DATA_KEY}`),
            fetch(`https://api.twelvedata.com/exchange_rate?symbol=USD/VND&apikey=${TWELVE_DATA_KEY}`)
        ]);
        const krwData = await krwRes.json();
        const usdData = await usdRes.json();
        if (krwData.rate && usdData.rate && !krwData.code) {
            exchangeRate = parseFloat(krwData.rate);
            usdRate = parseFloat(usdData.rate);
            exchangeStatus = 'live';
            updateRateUI(widget, statusEl, usdWidget, usdSubtext, 'Realtime ~33p');
            return;
        }
        throw new Error(krwData.message || 'Twelve Data error');
    } catch (e) {
        console.log('Twelve Data failed:', e.message);
    }

    // Source 2: ExchangeRate-API (free, daily update)
    try {
        const [krwRes, usdRes] = await Promise.all([
            fetch('https://open.er-api.com/v6/latest/KRW'),
            fetch('https://open.er-api.com/v6/latest/USD')
        ]);
        if (!krwRes.ok || !usdRes.ok) throw new Error('API error');
        const krwData = await krwRes.json();
        const usdData = await usdRes.json();
        exchangeRate = krwData.rates.VND;
        usdRate = usdData.rates.VND;
        exchangeStatus = 'live';
        updateRateUI(widget, statusEl, usdWidget, usdSubtext, 'Live ~33p');
        return;
    } catch (e) {
        console.log('ExchangeRate-API failed:', e.message);
    }

    // Source 3: Fallback defaults
    if (!exchangeRate) { exchangeRate = 18.5; widget.textContent = '18.50 ₫'; document.getElementById('exchangeSubtext').textContent = '1 KRW ≈ 18.50 VND'; }
    if (!usdRate && usdWidget) { usdRate = 25500; usdWidget.textContent = '25.500 ₫'; if (usdSubtext) usdSubtext.textContent = '1 USD ≈ 25.500 VND'; }
    exchangeStatus = 'offline';
    statusEl.innerHTML = '⚡ Offline'; statusEl.className = 'exchange-status offline';
}

function convertFromKRW() {
    const r = exchangeRate || 18.5, u = usdRate || 25500;
    const krw = parseFloat(document.getElementById('krwInput').value) || 0;
    document.getElementById('vndInput').value = '';
    document.getElementById('usdInput').value = '';
    if (!krw) { document.getElementById('converterResult').textContent = 'Nhập số tiền để quy đổi'; return; }
    const vnd = Math.round(krw * r);
    const usd = (krw * r / u).toFixed(2);
    document.getElementById('converterResult').innerHTML = '🇻🇳 ' + fmtVND(vnd) + '&nbsp;&nbsp;|&nbsp;&nbsp;🇺🇸 $' + fmtFull(parseFloat(usd));
}
function convertFromVND() {
    const r = exchangeRate || 18.5, u = usdRate || 25500;
    const vnd = parseFloat(document.getElementById('vndInput').value) || 0;
    document.getElementById('krwInput').value = '';
    document.getElementById('usdInput').value = '';
    if (!vnd) { document.getElementById('converterResult').textContent = 'Nhập số tiền để quy đổi'; return; }
    const krw = Math.round(vnd / r);
    const usd = (vnd / u).toFixed(2);
    document.getElementById('converterResult').innerHTML = '🇰🇷 ' + fmtKRW(krw) + '&nbsp;&nbsp;|&nbsp;&nbsp;🇺🇸 $' + fmtFull(parseFloat(usd));
}
function convertFromUSD() {
    const r = exchangeRate || 18.5, u = usdRate || 25500;
    const usd = parseFloat(document.getElementById('usdInput').value) || 0;
    document.getElementById('krwInput').value = '';
    document.getElementById('vndInput').value = '';
    if (!usd) { document.getElementById('converterResult').textContent = 'Nhập số tiền để quy đổi'; return; }
    const vnd = Math.round(usd * u);
    const krw = Math.round(usd * u / r);
    document.getElementById('converterResult').innerHTML = '🇰🇷 ' + fmtKRW(krw) + '&nbsp;&nbsp;|&nbsp;&nbsp;🇻🇳 ' + fmtVND(vnd);
}

function renderAll() {
    renderSummary();
    renderBudgetHealth();
    renderSavingsGoals();
    renderMonthlyBudgetTable();
    renderBudgetDashboard();
    renderBudgetOverviewChart();
}

function renderWithoutTable() {
    renderSummary();
    renderBudgetHealth();
    renderSavingsGoals();
    renderBudgetDashboard();
    renderBudgetOverviewChart();
}

// ===== Formatters =====
function fmtVND(a) { return new Intl.NumberFormat('vi-VN').format(a) + ' ₫'; }
function fmtKRW(a) { return new Intl.NumberFormat('ko-KR').format(a) + ' ₩'; }
function fmtFull(a) { return new Intl.NumberFormat('vi-VN').format(a); }
function fmtCompact(a) {
    if (!a) return '';
    const abs = Math.abs(a);
    if (abs >= 1000000) return (a / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (abs >= 1000) return (a / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return a.toString();
}
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ===== Helper: get budget totals =====
function getBudgetTotals(year) {
    const y = year || budgetYear;
    let incKRW = 0, expKRW = 0;
    for (let m = 0; m < 12; m++) {
        const key = getBudgetKey(y, m);
        const b = monthlyBudget[key] || {};
        incKRW += Number(b.income || 0);
        expKRW += Number(b.expense || 0);
    }
    return { incKRW, expKRW, balanceKRW: incKRW - expKRW };
}

function getAllTimeTotals() {
    let incKRW = 0, expKRW = 0;
    Object.values(monthlyBudget).forEach(b => {
        incKRW += Number(b.income || 0);
        expKRW += Number(b.expense || 0);
    });
    return { incKRW, expKRW, balanceKRW: incKRW - expKRW };
}

// ===== Summary (VND cards at top) =====
function renderSummary() {
    const r = exchangeRate || 18.5;
    const u = usdRate || 25500;
    const { incKRW, expKRW, balanceKRW } = getAllTimeTotals();
    const income = Math.round(incKRW * r);
    const expense = Math.round(expKRW * r);
    const balance = income - expense;
    const rate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
    animateVal('totalBalance', fmtVND(balance));
    animateVal('totalIncome', fmtVND(income));
    animateVal('totalExpense', fmtVND(expense));
    animateVal('savingsRate', Math.max(0, rate) + '%');
    const balKRW = document.getElementById('balanceKRW');
    const incKRWEl = document.getElementById('incomeKRW');
    const expKRWEl = document.getElementById('expenseKRW');
    if (balKRW) balKRW.innerHTML = '≈ ' + fmtKRW(balanceKRW) + '<br><span class="sub-currency">≈ $' + fmtFull(Math.round(balanceKRW * r / u)) + '</span>';
    if (incKRWEl) incKRWEl.innerHTML = '≈ ' + fmtKRW(incKRW) + '<br><span class="sub-currency">≈ $' + fmtFull(Math.round(incKRW * r / u)) + '</span>';
    if (expKRWEl) expKRWEl.innerHTML = '≈ ' + fmtKRW(expKRW) + '<br><span class="sub-currency">≈ $' + fmtFull(Math.round(expKRW * r / u)) + '</span>';
    const sl = document.getElementById('savingsLabel');
    if (rate >= 50) sl.textContent = '🌟 Xuất sắc!'; else if (rate >= 30) sl.textContent = '👍 Tốt';
    else if (rate >= 10) sl.textContent = '⚠️ Cần cải thiện'; else if (income > 0) sl.textContent = '🚨 Rất ít';
    else sl.textContent = '--';
}

function animateVal(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.textContent === val) return;
    el.style.transform = 'scale(0.97)';
    el.textContent = val;
    requestAnimationFrame(() => {
        el.style.transform = 'scale(1)';
    });
}

// ===== Budget KRW Dashboard (above table) =====
function renderBudgetDashboard() {
    const { incKRW, expKRW, balanceKRW } = getBudgetTotals();
    const r = exchangeRate || 18.5;
    const u = usdRate || 25500;
    const rate = incKRW > 0 ? Math.round(((incKRW - expKRW) / incKRW) * 100) : 0;
    const di = document.getElementById('dashTotalIncome');
    const de = document.getElementById('dashTotalExpense');
    const db = document.getElementById('dashTotalBalance');
    const ds = document.getElementById('dashSavingsRate');
    if (di) di.innerHTML = fmtKRW(incKRW) + '<br><span class="sub-currency">≈ ' + fmtVND(Math.round(incKRW * r)) + '</span><br><span class="sub-currency">≈ $' + fmtFull(Math.round(incKRW * r / u)) + '</span>';
    if (de) de.innerHTML = fmtKRW(expKRW) + '<br><span class="sub-currency">≈ ' + fmtVND(Math.round(expKRW * r)) + '</span><br><span class="sub-currency">≈ $' + fmtFull(Math.round(expKRW * r / u)) + '</span>';
    if (db) { db.innerHTML = fmtKRW(balanceKRW) + '<br><span class="sub-currency">≈ ' + fmtVND(Math.round(balanceKRW * r)) + '</span><br><span class="sub-currency">≈ $' + fmtFull(Math.round(balanceKRW * r / u)) + '</span>'; db.style.color = balanceKRW >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'; }
    if (ds) ds.textContent = Math.max(0, rate) + '%';
}

// ===== Budget Health =====
function renderBudgetHealth() {
    const scoreEl = document.getElementById('healthScore'), labelEl = document.getElementById('healthLabel'), iconEl = document.getElementById('healthIcon');
    if (!scoreEl) return;
    const r = exchangeRate || 18.5;
    const { incKRW, expKRW } = getBudgetTotals();
    const income = Math.round(incKRW * r);
    const expense = Math.round(expKRW * r);
    if (!income && !expense) { scoreEl.textContent = '--'; labelEl.textContent = 'Chưa có dữ liệu'; iconEl.textContent = '🏥'; return; }
    const sr = income > 0 ? (income - expense) / income : 0;
    const now = new Date(), ck = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const cb = monthlyBudget[ck] || {}, cl = Math.round(Number(cb.income || 0) * 0.40), ce = Number(cb.expense || 0);
    const ba = cl > 0 ? Math.max(0, 1 - (ce / cl - 1)) : 1;
    let score = Math.max(0, Math.min(100, Math.round(sr * 60 + ba * 40)));
    let grade, label, icon, color;
    if (score >= 85) { grade = 'A+'; label = 'Xuất sắc!'; icon = '🏆'; color = '#00b894'; }
    else if (score >= 70) { grade = 'A'; label = 'Rất tốt'; icon = '🌟'; color = '#55efc4'; }
    else if (score >= 55) { grade = 'B'; label = 'Khá tốt'; icon = '👍'; color = '#ffd93d'; }
    else if (score >= 40) { grade = 'C'; label = 'Trung bình'; icon = '⚡'; color = '#ffa502'; }
    else if (score >= 25) { grade = 'D'; label = 'Cần cải thiện'; icon = '⚠️'; color = '#ff6b6b'; }
    else { grade = 'F'; label = 'Nguy hiểm!'; icon = '🚨'; color = '#d63031'; }
    scoreEl.textContent = grade;
    scoreEl.style.color = color;
    labelEl.textContent = `${icon} ${label} (${score}/100)`;
    if (iconEl) iconEl.textContent = icon;
}

// ===== Savings Goals =====
function previewGoalVND() {
    const krw = parseInt(document.getElementById('goalAmount').value) || 0;
    const el = document.getElementById('goalVndPreview');
    if (!el) return;
    if (krw > 0) {
        const r = exchangeRate || 18.5;
        el.textContent = '≈ ' + fmtVND(Math.round(krw * r));
    } else {
        el.textContent = '';
    }
}

async function addSavingsGoal() {
    const name = document.getElementById('goalName').value.trim();
    const amountKRW = parseInt(document.getElementById('goalAmount').value);
    const months = parseInt(document.getElementById('goalMonths').value);
    if (!name || !amountKRW || !months) { showToast('Điền đầy đủ mục tiêu!', 'error'); return; }

    try {
        const goal = await saveGoal(name, amountKRW, months);
        goal.amountVND = Math.round(amountKRW * (exchangeRate || 18.5));
        savingsGoals.push(goal);
        document.getElementById('goalName').value = '';
        document.getElementById('goalAmount').value = '';
        document.getElementById('goalMonths').value = '';
        const preview = document.getElementById('goalVndPreview');
        if (preview) preview.textContent = '';
        renderSavingsGoals();
        showToast(`🎯 Mục tiêu "${name}" đã thêm!`, 'success');
    } catch (err) {
        showToast('Lỗi lưu mục tiêu: ' + err.message, 'error');
    }
}

async function deleteSavingsGoal(id) {
    try {
        await deleteGoalFromDB(id);
        savingsGoals = savingsGoals.filter(g => g.id !== id);
        renderSavingsGoals();
        showToast('🗑️ Đã xóa mục tiêu', 'info');
    } catch (err) {
        showToast('Lỗi xóa: ' + err.message, 'error');
    }
}

function renderSavingsGoals() {
    const container = document.getElementById('goalsList');
    if (!container) return;
    if (!savingsGoals.length) { container.innerHTML = ''; return; }
    const { balanceKRW } = getAllTimeTotals();
    const balance = Math.round(balanceKRW * (exchangeRate || 18.5));
    const r = exchangeRate || 18.5;

    container.innerHTML = savingsGoals.map(g => {
        const targetVND = g.amountVND || Math.round(g.amountKRW * r);
        const pct = Math.min(100, Math.max(0, Math.round((balance / targetVND) * 100)));
        const monthlyNeeded = Math.round(g.amountKRW / g.months);
        return `<div class="goal-item">
            <div class="goal-info">
                <div class="goal-name">🎯 ${escapeHtml(g.name)}</div>
                <div class="goal-details">
                    <span>💰 ${fmtKRW(g.amountKRW)} (${fmtVND(targetVND)})</span>
                    <span>📅 ${g.months} tháng</span>
                    <span>💵 ${fmtKRW(monthlyNeeded)}/tháng</span>
                </div>
                <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${pct}%;${pct >= 100 ? 'background:linear-gradient(90deg,#00b894,#55efc4);' : ''}"></div></div>
            </div>
            <div class="goal-pct">${pct}%</div>
            <button class="goal-delete" onclick="deleteSavingsGoal('${g.id}')" title="Xóa">🗑️</button>
        </div>`;
    }).join('');
}

// ===== Budget Table =====
function getBudgetKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }

function changeYear(delta) { budgetYear += delta; document.getElementById('yearLabel').textContent = budgetYear; renderAll(); }

function onIncomeInput(month, value) {
    const key = getBudgetKey(budgetYear, month);
    if (!monthlyBudget[key]) monthlyBudget[key] = {};
    monthlyBudget[key].income = parseInt(value) || 0;
    updateRowInline(month);
    renderWithoutTable();
    updateTableFooter();
    debounceSaveBudget(budgetYear, month, monthlyBudget[key].income, monthlyBudget[key].expense || 0);
}

function onExpenseInput(month, value) {
    const key = getBudgetKey(budgetYear, month);
    if (!monthlyBudget[key]) monthlyBudget[key] = {};
    monthlyBudget[key].expense = parseInt(value) || 0;
    updateRowInline(month);
    renderWithoutTable();
    updateTableFooter();
    debounceSaveBudget(budgetYear, month, monthlyBudget[key].income || 0, monthlyBudget[key].expense);
}

function updateRowInline(month) {
    const tbody = document.getElementById('budgetTableBody');
    if (!tbody) return;
    const row = tbody.rows[month];
    if (!row) return;
    const key = getBudgetKey(budgetYear, month);
    const data = monthlyBudget[key] || {};
    const inc = Number(data.income || 0), exp = Number(data.expense || 0);
    const living = Math.round(inc * 0.40), reserve = Math.round(inc * 0.40), invest = Math.round(inc * 0.20);
    const balance = inc - exp, surplus = living - exp;
    const reserveFromBalance = Math.round(balance * 0.40);
    const investFromBalance = Math.round(balance * 0.20);
    const bC = balance >= 0 ? 'positive' : 'negative', sC = surplus >= 0 ? 'positive' : 'negative';
    const reserveDisplay = inc ? `${fmtFull(reserve)}<span class="cell-new-val">/ ${fmtFull(reserveFromBalance)}</span>` : '-';
    const investDisplay = inc ? `${fmtFull(invest)}<span class="cell-new-val">/ ${fmtFull(investFromBalance)}</span>` : '-';
    // Update cells (skip col 0=month, 1=income input, 5=expense input)
    row.cells[2].innerHTML = inc ? fmtFull(living) : '-';
    row.cells[2].className = 'cell-living';
    row.cells[3].innerHTML = reserveDisplay;
    row.cells[3].className = 'cell-reserve';
    row.cells[4].innerHTML = investDisplay;
    row.cells[4].className = 'cell-invest';
    row.cells[6].innerHTML = inc || exp ? fmtFull(balance) : '-';
    row.cells[6].className = `cell-balance ${bC}`;
    row.cells[7].innerHTML = inc || exp ? fmtFull(surplus) : '-';
    row.cells[7].className = `cell-surplus ${sC}`;
}

function updateTableFooter() {
    const tfoot = document.getElementById('budgetTableFoot');
    if (!tfoot) return;
    const rate = exchangeRate || 18.5;
    let tI = 0, tL = 0, tR = 0, tV = 0, tE = 0, tS = 0;
    let tRnew = 0, tVnew = 0;
    for (let m = 0; m < 12; m++) {
        const key = getBudgetKey(budgetYear, m), data = monthlyBudget[key] || {};
        const inc = Number(data.income || 0), exp = Number(data.expense || 0);
        const living = Math.round(inc * 0.40), reserve = Math.round(inc * 0.40), invest = Math.round(inc * 0.20);
        const balance = inc - exp, surplus = living - exp;
        const reserveFromBalance = Math.round(balance * 0.40);
        const investFromBalance = Math.round(balance * 0.20);
        tI += inc; tL += living; tR += reserve; tV += invest; tE += exp; tS += surplus;
        tRnew += (inc || exp) ? reserveFromBalance : 0;
        tVnew += (inc || exp) ? investFromBalance : 0;
    }
    const tB = tI - tE, bC = tB >= 0 ? 'positive' : 'negative', sC = tS >= 0 ? 'positive' : 'negative';
    tfoot.innerHTML = `<tr>
        <td><strong>Tổng ₩</strong></td>
        <td style="color:var(--accent-green);font-weight:700;text-align:center;">${fmtFull(tI)}</td>
        <td class="cell-living">${fmtFull(tL)}</td>
        <td class="cell-reserve">${fmtFull(tR)}<span class="cell-new-val">/ ${fmtFull(tRnew)}</span></td>
        <td class="cell-invest">${fmtFull(tV)}<span class="cell-new-val">/ ${fmtFull(tVnew)}</span></td>
        <td style="color:var(--accent-red);font-weight:700;text-align:center;">${fmtFull(tE)}</td>
        <td class="cell-balance ${bC}">${fmtFull(tB)}</td>
        <td class="cell-surplus ${sC}">${fmtFull(tS)}</td>
    </tr>
    <tr style="font-size:0.68rem;opacity:0.75;">
        <td><strong>Tổng ₫</strong></td>
        <td style="color:var(--accent-green);text-align:center;">${fmtFull(Math.round(tI * rate))}</td>
        <td class="cell-living">${fmtFull(Math.round(tL * rate))}</td>
        <td class="cell-reserve">${fmtFull(Math.round(tR * rate))}<span class="cell-new-val">/ ${fmtFull(Math.round(tRnew * rate))}</span></td>
        <td class="cell-invest">${fmtFull(Math.round(tV * rate))}<span class="cell-new-val">/ ${fmtFull(Math.round(tVnew * rate))}</span></td>
        <td style="color:var(--accent-red);text-align:center;">${fmtFull(Math.round(tE * rate))}</td>
        <td class="cell-balance ${bC}">${fmtFull(Math.round(tB * rate))}</td>
        <td class="cell-surplus ${sC}">${fmtFull(Math.round(tS * rate))}</td>
    </tr>`;
}

function debounceSaveBudget(year, month, income, expense) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            await saveBudget(year, month, income, expense);
        } catch (err) {
            console.error('Save budget error:', err);
            showToast('Lỗi lưu: ' + err.message, 'error');
        }
    }, 800);
}

function renderMonthlyBudgetTable() {
    const tbody = document.getElementById('budgetTableBody'), tfoot = document.getElementById('budgetTableFoot');
    if (!tbody || !tfoot) return;
    const rate = exchangeRate || 18.5;
    let tI = 0, tL = 0, tR = 0, tV = 0, tE = 0, tS = 0;
    let tRnew = 0, tVnew = 0;
    let rows = '';
    for (let m = 0; m < 12; m++) {
        const key = getBudgetKey(budgetYear, m), data = monthlyBudget[key] || {};
        const inc = Number(data.income || 0), exp = Number(data.expense || 0);
        const living = Math.round(inc * 0.40), reserve = Math.round(inc * 0.40), invest = Math.round(inc * 0.20);
        const balance = inc - exp, surplus = living - exp;
        const reserveFromBalance = Math.round(balance * 0.40);
        const investFromBalance = Math.round(balance * 0.20);
        tI += inc; tL += living; tR += reserve; tV += invest; tE += exp; tS += surplus;
        tRnew += (inc || exp) ? reserveFromBalance : 0;
        tVnew += (inc || exp) ? investFromBalance : 0;
        const bC = balance >= 0 ? 'positive' : 'negative', sC = surplus >= 0 ? 'positive' : 'negative';
        const isCurrent = budgetYear === new Date().getFullYear() && m === new Date().getMonth();
        const reserveDisplay = inc ? `${fmtFull(reserve)}<span class="cell-new-val">/ ${fmtFull(reserveFromBalance)}</span>` : '-';
        const investDisplay = inc ? `${fmtFull(invest)}<span class="cell-new-val">/ ${fmtFull(investFromBalance)}</span>` : '-';
        rows += `<tr${isCurrent ? ' style="background:rgba(108,92,231,0.08);"' : ''}>
            <td>${MONTHS[m]}</td>
            <td><input class="income-input" type="number" value="${inc || ''}" placeholder="₩" oninput="onIncomeInput(${m},this.value)" onfocus="this.select()"></td>
            <td class="cell-living">${inc ? fmtFull(living) : '-'}</td>
            <td class="cell-reserve">${reserveDisplay}</td>
            <td class="cell-invest">${investDisplay}</td>
            <td><input class="expense-input" type="number" value="${exp || ''}" placeholder="₩" oninput="onExpenseInput(${m},this.value)" onfocus="this.select()"></td>
            <td class="cell-balance ${bC}">${inc || exp ? fmtFull(balance) : '-'}</td>
            <td class="cell-surplus ${sC}">${inc || exp ? fmtFull(surplus) : '-'}</td>
        </tr>`;
    }
    tbody.innerHTML = rows;
    const tB = tI - tE, bC = tB >= 0 ? 'positive' : 'negative', sC = tS >= 0 ? 'positive' : 'negative';
    tfoot.innerHTML = `<tr>
        <td><strong>Tổng ₩</strong></td>
        <td style="color:var(--accent-green);font-weight:700;text-align:center;">${fmtFull(tI)}</td>
        <td class="cell-living">${fmtFull(tL)}</td>
        <td class="cell-reserve">${fmtFull(tR)}<span class="cell-new-val">/ ${fmtFull(tRnew)}</span></td>
        <td class="cell-invest">${fmtFull(tV)}<span class="cell-new-val">/ ${fmtFull(tVnew)}</span></td>
        <td style="color:var(--accent-red);font-weight:700;text-align:center;">${fmtFull(tE)}</td>
        <td class="cell-balance ${bC}">${fmtFull(tB)}</td>
        <td class="cell-surplus ${sC}">${fmtFull(tS)}</td>
    </tr>
    <tr style="font-size:0.68rem;opacity:0.75;">
        <td><strong>Tổng ₫</strong></td>
        <td style="color:var(--accent-green);text-align:center;">${fmtFull(Math.round(tI * rate))}</td>
        <td class="cell-living">${fmtFull(Math.round(tL * rate))}</td>
        <td class="cell-reserve">${fmtFull(Math.round(tR * rate))}<span class="cell-new-val">/ ${fmtFull(Math.round(tRnew * rate))}</span></td>
        <td class="cell-invest">${fmtFull(Math.round(tV * rate))}<span class="cell-new-val">/ ${fmtFull(Math.round(tVnew * rate))}</span></td>
        <td style="color:var(--accent-red);text-align:center;">${fmtFull(Math.round(tE * rate))}</td>
        <td class="cell-balance ${bC}">${fmtFull(Math.round(tB * rate))}</td>
        <td class="cell-surplus ${sC}">${fmtFull(Math.round(tS * rate))}</td>
    </tr>`;
}

// ===== Budget Overview Line Chart =====
function renderBudgetOverviewChart() {
    const container = document.getElementById('budgetOverviewChart');
    if (!container) return;
    const labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const series = { income: [], living: [], expense: [], balance: [], reserve: [], invest: [] };
    let hasData = false;
    for (let m = 0; m < 12; m++) {
        const key = getBudgetKey(budgetYear, m), bd = monthlyBudget[key] || {};
        const inc = Number(bd.income || 0), exp = Number(bd.expense || 0);
        const living = Math.round(inc * 0.40);
        const reserve = Math.round(inc * 0.40);
        const invest = Math.round(inc * 0.20);
        const bal = inc - exp;
        if (inc || exp) hasData = true;
        series.income.push(inc);
        series.living.push(living);
        series.expense.push(exp);
        series.balance.push(bal);
        series.reserve.push(reserve);
        series.invest.push(invest);
    }
    if (!hasData) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Nhập dữ liệu để xem biểu đồ</p></div>';
        return;
    }

    // Chart dimensions
    const W = 900, H = 340;
    const pad = { top: 25, right: 20, bottom: 35, left: 55 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;

    // Find max value for Y axis
    const allVals = [...series.income, ...series.living, ...series.expense, ...series.balance, ...series.reserve, ...series.invest];
    const maxVal = Math.max(...allVals, 1);
    const niceMax = getNiceMax(maxVal);

    // Helper functions
    function getNiceMax(v) {
        if (v <= 0) return 100;
        const mag = Math.pow(10, Math.floor(Math.log10(v)));
        const norm = v / mag;
        if (norm <= 1.5) return 1.5 * mag;
        if (norm <= 2) return 2 * mag;
        if (norm <= 3) return 3 * mag;
        if (norm <= 5) return 5 * mag;
        if (norm <= 7.5) return 7.5 * mag;
        return 10 * mag;
    }
    function xPos(i) { return pad.left + (i / 11) * cW; }
    function yPos(v) { return pad.top + cH - (v / niceMax) * cH; }

    // Build gridlines
    const gridLines = 5;
    let gridSvg = '';
    for (let i = 0; i <= gridLines; i++) {
        const val = Math.round((niceMax / gridLines) * i);
        const y = yPos(val);
        gridSvg += `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4,3"/>`;
        gridSvg += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10" font-family="Inter,sans-serif">${fmtCompact(val)}</text>`;
    }

    // X axis labels
    let xLabels = '';
    for (let i = 0; i < 12; i++) {
        const x = xPos(i);
        xLabels += `<text x="${x}" y="${H - 8}" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-weight="600" font-family="Inter,sans-serif">${labels[i]}</text>`;
    }

    // Line series config
    const lineConfig = [
        { key: 'income', color: '#4a90d9', width: 2.5, dash: '', fill: true },
        { key: 'living', color: '#e74c3c', width: 2, dash: '', fill: false },
        { key: 'expense', color: '#8e44ad', width: 2, dash: '6,3', fill: false },
        { key: 'balance', color: '#27ae60', width: 2, dash: '4,2', fill: false },
        { key: 'reserve', color: '#f39c12', width: 1.8, dash: '3,3', fill: false },
        { key: 'invest', color: '#00cec9', width: 1.8, dash: '3,3', fill: false },
    ];

    let linesSvg = '';
    let dotsSvg = '';
    let labelsSvg = '';

    lineConfig.forEach(cfg => {
        const vals = series[cfg.key];
        // Build path
        let points = [];
        for (let i = 0; i < 12; i++) {
            points.push(`${xPos(i).toFixed(1)},${yPos(vals[i]).toFixed(1)}`);
        }
        const pathD = 'M' + points.join('L');

        // Fill area (only for income)
        if (cfg.fill) {
            const fillD = pathD + `L${xPos(11).toFixed(1)},${yPos(0).toFixed(1)}L${xPos(0).toFixed(1)},${yPos(0).toFixed(1)}Z`;
            linesSvg += `<path d="${fillD}" fill="${cfg.color}" fill-opacity="0.08"/>`;
        }

        // Line
        linesSvg += `<path d="${pathD}" fill="none" stroke="${cfg.color}" stroke-width="${cfg.width}" stroke-dasharray="${cfg.dash}" stroke-linecap="round" stroke-linejoin="round"/>`;

        // Dots and labels
        for (let i = 0; i < 12; i++) {
            if (vals[i] === 0 && !series.income[i] && !series.expense[i]) continue;
            const x = xPos(i), y = yPos(vals[i]);
            dotsSvg += `<circle cx="${x}" cy="${y}" r="3.5" fill="${cfg.color}" stroke="var(--bg-card)" stroke-width="1.5"/>`;
            // Show value labels for key series
            if (cfg.key === 'income' || cfg.key === 'expense' || cfg.key === 'balance') {
                if (vals[i] !== 0) {
                    const labelY = cfg.key === 'income' ? y - 10 : (cfg.key === 'balance' ? y + 15 : y - 10);
                    labelsSvg += `<text x="${x}" y="${labelY}" text-anchor="middle" fill="${cfg.color}" font-size="9" font-weight="600" font-family="Inter,sans-serif">${fmtCompact(vals[i])}</text>`;
                }
            }
        }
    });

    // Current month indicator
    const curMonth = new Date().getMonth();
    let curMonthSvg = '';
    if (budgetYear === new Date().getFullYear()) {
        const cx = xPos(curMonth);
        curMonthSvg = `<line x1="${cx}" y1="${pad.top}" x2="${cx}" y2="${pad.top + cH}" stroke="var(--accent-primary)" stroke-width="1" stroke-dasharray="4,4" opacity="0.5"/>`;
    }

    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="line-chart-svg">
        ${gridSvg}
        ${xLabels}
        ${curMonthSvg}
        ${linesSvg}
        ${dotsSvg}
        ${labelsSvg}
    </svg>`;
}

// ===== Chart Fullscreen =====
function openChartFullscreen() {
    const chart = document.getElementById('budgetOverviewChart');
    const overlay = document.getElementById('chartFullscreen');
    const content = document.getElementById('chartFullscreenContent');
    if (!chart || !overlay || !content) return;
    const svg = chart.querySelector('svg');
    if (!svg) { showToast('Chưa có biểu đồ để phóng to', 'info'); return; }
    content.innerHTML = svg.outerHTML;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeChartFullscreen(e) {
    if (e && e.target !== document.getElementById('chartFullscreen')) return;
    const overlay = document.getElementById('chartFullscreen');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ===== Toast =====
function showToast(msg, type = 'info') { const t = document.getElementById('toast'); if (!t) return; t.textContent = msg; t.className = `toast ${type} show`; setTimeout(() => t.classList.remove('show'), 2600); }

// ===== PWA =====
function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => { });
    }
}

// Init
init();
