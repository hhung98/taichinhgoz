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
    setInterval(fetchExchangeRate, 300000);
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
            updateRateUI(widget, statusEl, usdWidget, usdSubtext, 'Realtime ~5p');
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
        updateRateUI(widget, statusEl, usdWidget, usdSubtext, 'Live ~5p');
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

function convertFromKRW() { if (!exchangeRate) return; const krw = parseFloat(document.getElementById('krwInput').value) || 0; document.getElementById('converterResult').textContent = fmtVND(Math.round(krw * exchangeRate)) + ' (VND)'; }
function convertFromVND() { if (!exchangeRate) return; const vnd = parseFloat(document.getElementById('vndInput').value) || 0; document.getElementById('converterResult').textContent = fmtKRW(Math.round(vnd / exchangeRate)) + ' (KRW)'; }

function renderAll() {
    renderSummary();
    renderBudgetHealth();
    renderSavingsGoals();
    renderMonthlyBudgetTable();
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
function getBudgetTotals() {
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
    const { incKRW, expKRW, balanceKRW } = getBudgetTotals();
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

function animateVal(id, val) { const el = document.getElementById(id); if (!el) return; el.style.transform = 'scale(0.95)'; el.style.opacity = '0.7'; setTimeout(() => { el.textContent = val; el.style.transform = 'scale(1)'; el.style.opacity = '1'; }, 150); }

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
    const cb = monthlyBudget[ck] || {}, cl = Math.round(Number(cb.income || 0) * 0.35), ce = Number(cb.expense || 0);
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
    const { balanceKRW } = getBudgetTotals();
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

function changeYear(delta) { budgetYear += delta; document.getElementById('yearLabel').textContent = budgetYear; renderMonthlyBudgetTable(); renderBudgetDashboard(); renderBudgetOverviewChart(); }

function onIncomeInput(month, value) {
    const key = getBudgetKey(budgetYear, month);
    if (!monthlyBudget[key]) monthlyBudget[key] = {};
    monthlyBudget[key].income = parseInt(value) || 0;
    renderAll();
    debounceSaveBudget(budgetYear, month, monthlyBudget[key].income, monthlyBudget[key].expense || 0);
}

function onExpenseInput(month, value) {
    const key = getBudgetKey(budgetYear, month);
    if (!monthlyBudget[key]) monthlyBudget[key] = {};
    monthlyBudget[key].expense = parseInt(value) || 0;
    renderAll();
    debounceSaveBudget(budgetYear, month, monthlyBudget[key].income || 0, monthlyBudget[key].expense);
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
    let rows = '';
    for (let m = 0; m < 12; m++) {
        const key = getBudgetKey(budgetYear, m), data = monthlyBudget[key] || {};
        const inc = Number(data.income || 0), exp = Number(data.expense || 0);
        const living = Math.round(inc * 0.35), reserve = Math.round(inc * 0.45), invest = Math.round(inc * 0.20);
        const balance = inc - exp, surplus = living - exp;
        tI += inc; tL += living; tR += reserve; tV += invest; tE += exp; tS += surplus;
        const bC = balance >= 0 ? 'positive' : 'negative', sC = surplus >= 0 ? 'positive' : 'negative';
        const isCurrent = budgetYear === new Date().getFullYear() && m === new Date().getMonth();
        rows += `<tr${isCurrent ? ' style="background:rgba(108,92,231,0.08);"' : ''}>
            <td>${MONTHS[m]}</td>
            <td><input class="income-input" type="number" value="${inc || ''}" placeholder="₩" onchange="onIncomeInput(${m},this.value)" onfocus="this.select()"></td>
            <td class="cell-living">${inc ? fmtFull(living) : '-'}</td>
            <td class="cell-reserve">${inc ? fmtFull(reserve) : '-'}</td>
            <td class="cell-invest">${inc ? fmtFull(invest) : '-'}</td>
            <td><input class="expense-input" type="number" value="${exp || ''}" placeholder="₩" onchange="onExpenseInput(${m},this.value)" onfocus="this.select()"></td>
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
        <td class="cell-reserve">${fmtFull(tR)}</td>
        <td class="cell-invest">${fmtFull(tV)}</td>
        <td style="color:var(--accent-red);font-weight:700;text-align:center;">${fmtFull(tE)}</td>
        <td class="cell-balance ${bC}">${fmtFull(tB)}</td>
        <td class="cell-surplus ${sC}">${fmtFull(tS)}</td>
    </tr>
    <tr style="font-size:0.68rem;opacity:0.75;">
        <td><strong>Tổng ₫</strong></td>
        <td style="color:var(--accent-green);text-align:center;">${fmtFull(Math.round(tI * rate))}</td>
        <td class="cell-living">${fmtFull(Math.round(tL * rate))}</td>
        <td class="cell-reserve">${fmtFull(Math.round(tR * rate))}</td>
        <td class="cell-invest">${fmtFull(Math.round(tV * rate))}</td>
        <td style="color:var(--accent-red);text-align:center;">${fmtFull(Math.round(tE * rate))}</td>
        <td class="cell-balance ${bC}">${fmtFull(Math.round(tB * rate))}</td>
        <td class="cell-surplus ${sC}">${fmtFull(Math.round(tS * rate))}</td>
    </tr>`;
}

// ===== Budget Overview Chart =====
function renderBudgetOverviewChart() {
    const container = document.getElementById('budgetOverviewChart');
    if (!container) return;
    const labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const data = [];
    let hasData = false;
    for (let m = 0; m < 12; m++) {
        const key = getBudgetKey(budgetYear, m), bd = monthlyBudget[key] || {};
        const inc = Number(bd.income || 0), exp = Number(bd.expense || 0);
        const living = Math.round(inc * 0.35);
        const surplus = living - exp;
        if (inc || exp) hasData = true;
        data.push({ label: labels[m], income: inc, expense: exp, living, surplus });
    }
    if (!hasData) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Nhập dữ liệu để xem biểu đồ</p></div>';
        return;
    }
    const mx = Math.max(...data.flatMap(d => [d.income, d.expense, d.living, Math.abs(d.surplus)]), 1);
    const isCurrent = (m) => budgetYear === new Date().getFullYear() && m === new Date().getMonth();
    container.innerHTML = data.map((d, i) => {
        const incH = Math.max((d.income / mx) * 120, d.income ? 4 : 0);
        const expH = Math.max((d.expense / mx) * 120, d.expense ? 4 : 0);
        const livH = Math.max((d.living / mx) * 120, d.living ? 4 : 0);
        const hasSurplus = d.income || d.expense;
        const surH = hasSurplus ? Math.max((Math.abs(d.surplus) / mx) * 120, 4) : 0;
        const surColor = d.surplus >= 0 ? '#fdcb6e' : '#d63031';
        const current = isCurrent(i) ? ' current-month' : '';
        return `<div class="chart-bar-group${current}">
            <div class="chart-bars">
                <div class="chart-bar-wrapper">
                    <span class="bar-val">${d.income ? fmtCompact(d.income) : ''}</span>
                    <div class="chart-bar income-bar" style="height:${incH}px" title="Thu: ${fmtKRW(d.income)}"></div>
                </div>
                <div class="chart-bar-wrapper">
                    <span class="bar-val">${d.expense ? fmtCompact(d.expense) : ''}</span>
                    <div class="chart-bar expense-bar" style="height:${expH}px" title="Chi: ${fmtKRW(d.expense)}"></div>
                </div>
                <div class="chart-bar-wrapper">
                    <span class="bar-val">${d.living ? fmtCompact(d.living) : ''}</span>
                    <div class="chart-bar living-bar" style="height:${livH}px" title="SH: ${fmtKRW(d.living)}"></div>
                </div>
                <div class="chart-bar-wrapper">
                    <span class="bar-val" style="color:${surColor}">${d.surplus ? fmtCompact(d.surplus) : ''}</span>
                    <div class="chart-bar surplus-bar" style="height:${surH}px;background:${surColor}" title="Dư/Thiếu: ${fmtKRW(d.surplus)}"></div>
                </div>
            </div>
            <div class="chart-bar-label">${d.label}</div>
        </div>`;
    }).join('');
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
