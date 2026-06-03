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

const DEMO_MONTHLY_BUDGET = [
    { month: 1, income: 2300000, expense: 2100000 },
    { month: 2, income: 2300000, expense: 1600000 },
    { month: 3, income: 2400000, expense: 1000000 },
    { month: 4, income: 2300000, expense: 1500000 },
    { month: 5, income: 232300, expense: 323 },
];

function getDemoBudgetData(year = budgetYear) {
    return DEMO_MONTHLY_BUDGET.reduce((acc, item) => {
        acc[getBudgetKey(year, item.month - 1)] = {
            income: item.income,
            expense: item.expense
        };
        return acc;
    }, {});
}

function applyDemoBudgetIfEmpty(data) {
    if (data && Object.keys(data).length) return data;
    return localStorage.getItem('goz_demo_data') === 'true' ? getDemoBudgetData() : data;
}

function iconMarkup(name, extraClass = '') {
    return `<i class="icon-svg ${extraClass}" data-lucide="${name}"></i>`;
}

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    }
}

function initScrollReveal() {
    const REVEAL_STAGGER = 35;
    const REVEAL_MAX_DELAY = 120;
    const targets = document.querySelectorAll(
        '.exchange-shell, .summary-card, .financial-insight-card, .panel, .budget-dash-item, .pie-card, .goal-item'
    );

    targets.forEach((el, index) => {
        el.classList.add('reveal-box', 'premium-card-hover');
        const groupIndex = index % 4;
        const delay = Math.min(groupIndex * REVEAL_STAGGER, REVEAL_MAX_DELAY);
        el.style.transitionDelay = `${delay}ms`;
        el.dataset.revealDelay = String(delay);
    });

    const pending = Array.from(targets).filter(el => !el.dataset.revealBound);
    if (!pending.length) return;

    if (!('IntersectionObserver' in window)) {
        pending.forEach(el => {
            el.classList.add('is-visible');
            el.dataset.revealBound = 'true';
        });
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.08, rootMargin: '0px 0px 8% 0px' });

    pending.forEach(el => {
        el.dataset.revealBound = 'true';
        observer.observe(el);
    });
}

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

// ===== Init =====
// ===== PIN LOCK =====
let appPin = localStorage.getItem('app_pin');
let pinEnabled = localStorage.getItem('pin_enabled') !== 'false'; // default ON
let currentPinInput = '';
let pinSetupStep = 1; // 1: setting up, 2: confirming
let tempPin = '';

function checkPinState() {
    const overlay = document.getElementById('pinOverlay');
    const title = document.getElementById('pinTitle');
    const sub = document.getElementById('pinSubtitle');
    const btnFor = document.getElementById('pinForgotBtn');
    
    currentPinInput = '';
    updatePinDots();
    updatePinToggleUI();
    
    // If PIN is disabled, skip the lock screen
    if (!pinEnabled) {
        overlay.classList.add('hidden');
        return;
    }
    
    if (appPin) {
        overlay.classList.remove('hidden');
        title.textContent = 'Nhập mã PIN';
        sub.textContent = 'Bảo mật sổ cái tài chính của bạn';
        if(btnFor) btnFor.style.visibility = 'visible';
        pinSetupStep = 0;
    } else {
        overlay.classList.remove('hidden');
        title.textContent = 'Tạo mã PIN mới';
        sub.textContent = 'Dùng để khóa ứng dụng lần sau';
        if(btnFor) btnFor.style.visibility = 'hidden';
        pinSetupStep = 1;
    }
}

function updatePinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
        if (i < currentPinInput.length) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

function handlePinKey(key) {
    if (key === 'backspace') {
        currentPinInput = currentPinInput.slice(0, -1);
    } else {
        if (currentPinInput.length < 4) {
            currentPinInput += key;
        }
    }
    updatePinDots();
    
    if (currentPinInput.length === 4) {
        setTimeout(() => processPinBlock(), 50);
    }
}

function processPinBlock() {
    const dotsContainer = document.getElementById('pinDots');
    
    if (pinSetupStep === 1) {
        tempPin = currentPinInput;
        currentPinInput = '';
        pinSetupStep = 2;
        document.getElementById('pinTitle').textContent = 'Xác nhận mã PIN';
        document.getElementById('pinSubtitle').textContent = 'Nhập lại mã PIN vừa chọn';
        updatePinDots();
    } else if (pinSetupStep === 2) {
        if (currentPinInput === tempPin) {
            appPin = btoa(currentPinInput);
            localStorage.setItem('app_pin', appPin);
            currentPinInput = ''; // Clear immediately
            unlockApp();
            showToast('Đã thiết lập mã PIN!', 'success');
        } else {
            dotsContainer.classList.add('shake');
            document.getElementById('pinSubtitle').textContent = 'Mã PIN không khớp. Nhập lại từ đầu.';
            document.getElementById('pinSubtitle').style.color = 'var(--accent-red)';
            setTimeout(() => {
                dotsContainer.classList.remove('shake');
                currentPinInput = '';
                pinSetupStep = 1;
                document.getElementById('pinTitle').textContent = 'Tạo mã PIN mới';
                document.getElementById('pinSubtitle').textContent = 'Dùng để khóa ứng dụng lần sau';
                document.getElementById('pinSubtitle').style.color = 'var(--text-secondary)';
                updatePinDots();
            }, 600);
        }
    } else {
        // Unlock Mode - Compare simply using Base64
        const attempt = btoa(currentPinInput);
        if (attempt === appPin) {
            currentPinInput = ''; // Clear immediately
            unlockApp();
        } else {
            dotsContainer.classList.add('shake');
            setTimeout(() => {
                dotsContainer.classList.remove('shake');
                currentPinInput = '';
                updatePinDots();
            }, 600);
            if (navigator.vibrate) navigator.vibrate(200);
        }
    }
}

function unlockApp() {
    document.getElementById('pinOverlay').classList.add('hidden');
}

async function forgotPin() {
    if (confirm("Lưu ý: Bạn chọn QUÊN MÃ PIN?\n\nỨng dụng sẽ xóa PIN cũ và ĐĂNG XUẤT tài khoản để bảo mật dữ liệu.\nBạn có chắc chắn muốn tiếp tục?")) {
        localStorage.removeItem('app_pin');
        appPin = null;
        await handleLogout();
    }
}

function togglePinSetting() {
    if (pinEnabled) {
        if (confirm('Tắt khóa mã PIN?\n\nLần sau mở app sẽ không cần nhập PIN nữa.')) {
            pinEnabled = false;
            localStorage.setItem('pin_enabled', 'false');
            localStorage.removeItem('app_pin');
            appPin = null;
            updatePinToggleUI();
            showToast('Đã tắt khóa PIN', 'info');
        }
    } else {
        pinEnabled = true;
        localStorage.setItem('pin_enabled', 'true');
        // Clear old PIN just in case to force new creation
        appPin = null;
        localStorage.removeItem('app_pin');
        updatePinToggleUI();
        // Immediately show PIN creation screen
        checkPinState();
        showToast('Hãy tạo mã PIN mới', 'info');
    }
}

function updatePinToggleUI() {
    const sw = document.getElementById('pinToggleSwitch');
    if (!sw) return;
    // UI should reflect pinEnabled regardless of appPin existence
    if (pinEnabled) {
        sw.classList.add('active');
    } else {
        sw.classList.remove('active');
    }
}

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
    checkPinState();
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
        monthlyBudget = applyDemoBudgetIfEmpty(await loadBudgets());
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
    const pinOverlay = document.getElementById('pinOverlay');
    if(pinOverlay) pinOverlay.classList.add('hidden');
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
                errorEl.textContent = 'Đăng ký thành công! Kiểm tra email để xác nhận.';
            }
        } else {
            await signInWithEmail(email, password);
        }
    } catch (err) {
        errorEl.style.color = 'var(--accent-red)';
        if (err.message.includes('Invalid login credentials')) {
            errorEl.textContent = 'Email hoặc mật khẩu không đúng.';
        } else if (err.message.includes('User already registered')) {
            errorEl.textContent = 'Email đã được đăng ký. Hãy đăng nhập.';
        } else if (err.message.includes('Email not confirmed')) {
            errorEl.textContent = 'Vui lòng xác nhận email trước khi đăng nhập.';
        } else {
            errorEl.textContent = err.message;
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = `${iconMarkup(isSignUpMode ? 'user-plus' : 'key-round')} ${isSignUpMode ? 'Đăng ký' : 'Đăng nhập'}`;
        refreshIcons();
    }
}

async function handleGoogleLogin() {
    try {
        await signInWithGoogle();
    } catch (err) {
        document.getElementById('authError').textContent = err.message;
    }
}

async function handleLogout() {
    try {
        await signOut();
        monthlyBudget = {};
        savingsGoals = [];
        showAuth();
        showToast('Đã đăng xuất', 'info');
    } catch (err) {
        showToast('Lỗi đăng xuất: ' + err.message, 'error');
    }
}

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    document.getElementById('nameField').style.display = isSignUpMode ? 'block' : 'none';
    document.getElementById('authSubmitBtn').innerHTML = `${iconMarkup(isSignUpMode ? 'user-plus' : 'key-round')} ${isSignUpMode ? 'Đăng ký' : 'Đăng nhập'}`;
    refreshIcons();
    document.getElementById('authToggleText').textContent = isSignUpMode ? 'Đã có tài khoản?' : 'Chưa có tài khoản?';
    document.getElementById('authToggleBtn').textContent = isSignUpMode ? 'Đăng nhập' : 'Đăng ký';
    document.getElementById('authError').textContent = '';
}

// ===== Theme =====
function applyTheme() {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    const btn = document.querySelector('.theme-toggle');
    if (btn) {
        btn.innerHTML = iconMarkup(isDark ? 'moon' : 'sun');
        refreshIcons();
    }
    const meta = document.getElementById('metaThemeColor');
    if (meta) meta.content = isDark ? '#08090d' : '#eef2f3';
}

function toggleTheme() {
    isDark = !isDark;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    applyTheme();
}

function setDefaultDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN', options);
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
    statusEl.textContent = 'Offline'; statusEl.className = 'exchange-status offline';
}

function convertFromKRW() {
    const r = exchangeRate || 18.5, u = usdRate || 25500;
    const krw = parseRawValue(document.getElementById('krwInput').value);
    document.getElementById('vndInput').value = '';
    document.getElementById('usdInput').value = '';
    if (!krw) { document.getElementById('converterResult').textContent = 'Nhập số tiền để quy đổi'; return; }
    const vnd = Math.round(krw * r);
    const usd = (krw * r / u).toFixed(2);
    document.getElementById('converterResult').innerHTML = 'VND ' + fmtVND(vnd) + '&nbsp;&nbsp;|&nbsp;&nbsp;USD $' + fmtFull(parseFloat(usd));
}
function convertFromVND() {
    const r = exchangeRate || 18.5, u = usdRate || 25500;
    const vnd = parseRawValue(document.getElementById('vndInput').value);
    document.getElementById('krwInput').value = '';
    document.getElementById('usdInput').value = '';
    if (!vnd) { document.getElementById('converterResult').textContent = 'Nhập số tiền để quy đổi'; return; }
    const krw = Math.round(vnd / r);
    const usd = (vnd / u).toFixed(2);
    document.getElementById('converterResult').innerHTML = 'KRW ' + fmtKRW(krw) + '&nbsp;&nbsp;|&nbsp;&nbsp;USD $' + fmtFull(parseFloat(usd));
}
function convertFromUSD() {
    const r = exchangeRate || 18.5, u = usdRate || 25500;
    const usd = parseRawValue(document.getElementById('usdInput').value);
    document.getElementById('krwInput').value = '';
    document.getElementById('vndInput').value = '';
    if (!usd) { document.getElementById('converterResult').textContent = 'Nhập số tiền để quy đổi'; return; }
    const vnd = Math.round(usd * u);
    const krw = Math.round(usd * u / r);
    document.getElementById('converterResult').innerHTML = 'KRW ' + fmtKRW(krw) + '&nbsp;&nbsp;|&nbsp;&nbsp;VND ' + fmtVND(vnd);
}

function renderAll() {
    renderSummary();
    renderFinancialInsight();
    renderBudgetHealth();
    renderSavingsGoals();
    renderMonthlyBudgetTable();
    renderBudgetDashboard();
    renderBudgetOverviewChart();
    renderPieCharts();
    refreshIcons();
    initScrollReveal();
}

function renderWithoutTable() {
    renderSummary();
    renderFinancialInsight();
    renderBudgetHealth();
    renderSavingsGoals();
    renderBudgetDashboard();
    renderBudgetOverviewChart();
    renderPieCharts();
    refreshIcons();
    initScrollReveal();
}

// ===== Formatters =====
function fmtVND(v) { return v.toLocaleString('vi-VN') + ' ₫'; }
function fmtKRW(v) { return v.toLocaleString('vi-VN') + ' ₩'; }
function fmtFull(v) { return v.toLocaleString('vi-VN'); }
function fmtFullRaw(v) { return v.toLocaleString('vi-VN'); }
function fmtCompact(v) {
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return v.toLocaleString('vi-VN');
}

function makeSmoothPath(points) {
    if (!points.length) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    return points.reduce((path, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        const prev = points[index - 1];
        const controlX = prev.x + (point.x - prev.x) / 2;
        return `${path} C ${controlX} ${prev.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
    }, '');
}

// Extract raw integer from formatted string
function parseRawValue(valStr) {
    return parseInt(String(valStr).replace(/\D/g, ''), 10) || 0;
}

// Live formatter for inputs
function formatInputLive(el) {
    let cursor = el.selectionStart;
    let oldLength = el.value.length;
    let rawStr = el.value.replace(/\D/g, '');
    if (rawStr === '') {
        el.value = '';
        return;
    }
    let formatted = parseInt(rawStr, 10).toLocaleString('vi-VN');
    el.value = formatted;
    let newLength = formatted.length;
    cursor += (newLength - oldLength);
    el.setSelectionRange(cursor, cursor);
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
    let incKRW = 0, expKRW = 0, count = 0, reserveSum = 0;
    for (const key in monthlyBudget) {
        const b = monthlyBudget[key];
        const income = Number(b.income || 0);
        const expense = Number(b.expense || 0);
        if (income > 0 || expense > 0) {
            incKRW += income;
            expKRW += expense;
            // Accumulate reserve from each month's surplus
            const balance = income - expense;
            if (balance > 0) {
                // Following the 2/3 of balance strategy for Emergency Fund
                reserveSum += Math.round(balance * (2/3));
            }
            count++;
        }
    }
    const balanceKRW = incKRW - expKRW;
    const avgExp = count > 0 ? expKRW / count : 0;
    return { incKRW, expKRW, balanceKRW, reserveSum, avgExp };
}

// ===== Summary (VND cards at top) =====
function renderSummary() {
    const r = exchangeRate || 18.5;
    const u = usdRate || 25500;
    const { incKRW, expKRW, balanceKRW, reserveSum, avgExp } = getAllTimeTotals();
    const income = Math.round(incKRW * r);
    const expense = Math.round(expKRW * r);
    const balance = income - expense;
    const rate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
    
    animateVal('totalBalance', fmtVND(balance));
    animateVal('totalIncome', fmtVND(income));
    animateVal('totalExpense', fmtVND(expense));
    animateVal('savingsRate', Math.max(0, rate) + '%');
    
    // Update Reserve/Emergency Fund Card with animation
    const resTotal = document.getElementById('reserveTotal');
    const survMonths = document.getElementById('survivalMonths');
    if (resTotal) resTotal.textContent = fmtKRW(reserveSum);
    if (survMonths) {
        const months = avgExp > 0 ? (reserveSum / avgExp).toFixed(1) : '--';
        survMonths.textContent = avgExp > 0 ? `An toàn: ${months} tháng` : 'An toàn: -- tháng';
    }

    const balKRW = document.getElementById('balanceKRW');
    const incKRWEl = document.getElementById('incomeKRW');
    const expKRWEl = document.getElementById('expenseKRW');
    if (balKRW) balKRW.innerHTML = '≈ ' + fmtKRW(balanceKRW) + '<br><span class="sub-currency">≈ $' + fmtFull(Math.round(balanceKRW * r / u)) + '</span>';
    if (incKRWEl) incKRWEl.innerHTML = '≈ ' + fmtKRW(incKRW) + '<br><span class="sub-currency">≈ $' + fmtFull(Math.round(incKRW * r / u)) + '</span>';
    if (expKRWEl) expKRWEl.innerHTML = '≈ ' + fmtKRW(expKRW) + '<br><span class="sub-currency">≈ $' + fmtFull(Math.round(expKRW * r / u)) + '</span>';
    const sl = document.getElementById('savingsLabel');
    if (rate >= 50) sl.textContent = 'Xuất sắc'; else if (rate >= 30) sl.textContent = 'Tốt';
    else if (rate >= 10) sl.textContent = 'Cần cải thiện'; else if (income > 0) sl.textContent = 'Rất ít';
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

function renderFinancialInsight() {
    const card = document.getElementById('financialInsightCard');
    const titleEl = document.getElementById('financialInsightTitle');
    const textEl = document.getElementById('financialInsightText');
    const scoreEl = document.getElementById('financialInsightScore');
    if (!card || !titleEl || !textEl || !scoreEl) return;

    const { incKRW, expKRW, balanceKRW, reserveSum, avgExp } = getAllTimeTotals();
    const income = incKRW;
    const expense = expKRW;
    const balance = balanceKRW;

    card.classList.remove('is-strong', 'is-warning', 'is-danger');

    if (!income && !expense) {
        titleEl.textContent = 'Chưa có dữ liệu';
        textEl.textContent = 'Nhập thu nhập và chi tiêu để nhận phân tích tự động.';
        scoreEl.textContent = '--';
        scoreEl.classList.add('health-score-ring');
        scoreEl.style.setProperty('--health-progress', '0%');
        scoreEl.style.setProperty('--health-color', 'var(--text-muted)');
        return;
    }

    const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;
    const survivalMonths = avgExp > 0 ? reserveSum / avgExp : 0;
    const currentMonthKey = getBudgetKey(new Date().getFullYear(), new Date().getMonth());
    const currentMonth = monthlyBudget[currentMonthKey] || {};
    const currentIncome = Number(currentMonth.income || 0);
    const currentExpense = Number(currentMonth.expense || 0);
    const livingBudget = Math.round(currentIncome * 0.40);
    const livingDelta = livingBudget - currentExpense;

    let title = 'Dòng tiền cần theo dõi';
    let text = 'Chi tiêu đang cao hơn phần còn lại. Hãy rà lại tháng có chi tiêu lớn nhất.';
    let tone = 'is-warning';

    if (savingsRate >= 50 && balance > 0) {
        title = 'Dòng tiền rất khỏe';
        text = `Tỷ lệ tiết kiệm đạt ${savingsRate}%. Quỹ dự phòng hiện đủ khoảng ${survivalMonths ? survivalMonths.toFixed(1) : '--'} tháng.`;
        tone = 'is-strong';
    } else if (savingsRate >= 25 && balance > 0) {
        title = 'Tài chính đang ổn định';
        text = `Bạn đang giữ lại ${fmtKRW(balance)} sau chi tiêu. Tiếp tục duy trì nhịp tiết kiệm hiện tại.`;
        tone = 'is-strong';
    } else if (balance < 0) {
        title = 'Chi tiêu đang vượt thu nhập';
        text = `Dòng tiền âm ${fmtKRW(Math.abs(balance))}. Nên giảm các khoản không thiết yếu trong tháng tới.`;
        tone = 'is-danger';
    } else if (currentIncome && livingDelta < 0) {
        title = 'Sinh hoạt vượt mức 40%';
        text = `Tháng này chi tiêu sinh hoạt vượt ${fmtKRW(Math.abs(livingDelta))} so với ngưỡng 40%.`;
        tone = 'is-warning';
    }

    card.classList.add(tone);
    titleEl.textContent = title;
    textEl.textContent = text;
    scoreEl.textContent = `${Math.max(0, savingsRate)}%`;
}

function showBudgetTooltip(event, monthIndex, income, expense, balance) {
    const tooltip = document.getElementById('budgetChartTooltip');
    if (!tooltip) return;

    const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;
    tooltip.innerHTML = `
        <div class="budget-chart-tooltip-title">Tháng ${monthIndex + 1}</div>
        <div><span>Thu nhập</span><strong>${fmtKRW(income)}</strong></div>
        <div><span>Chi tiêu</span><strong>${fmtKRW(expense)}</strong></div>
        <div><span>Còn lại</span><strong>${fmtKRW(balance)}</strong></div>
        <div><span>Tỷ lệ tiết kiệm</span><strong>${Math.max(0, savingsRate)}%</strong></div>
    `;

    const margin = 16;
    const width = 218;
    const left = Math.min(window.innerWidth - width - margin, event.clientX + 14);
    const top = Math.max(margin, event.clientY - 18);
    tooltip.style.left = `${Math.max(margin, left)}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add('visible');
}

function hideBudgetTooltip() {
    const tooltip = document.getElementById('budgetChartTooltip');
    if (tooltip) tooltip.classList.remove('visible');
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
    if (!income && !expense) {
        scoreEl.textContent = '--';
        labelEl.textContent = 'Chưa có dữ liệu';
        if (iconEl?.parentElement) iconEl.parentElement.innerHTML = iconMarkup('activity', 'health-icon');
        return;
    }
    const sr = income > 0 ? (income - expense) / income : 0;
    const now = new Date(), ck = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const cb = monthlyBudget[ck] || {}, cl = Math.round(Number(cb.income || 0) * 0.40), ce = Number(cb.expense || 0);
    const ba = cl > 0 ? Math.max(0, 1 - (ce / cl - 1)) : 1;
    let score = Math.max(0, Math.min(100, Math.round(sr * 60 + ba * 40)));
    let grade, label, icon, color;
    if (score >= 85) { grade = 'A+'; label = 'Xuất sắc'; icon = 'award'; color = '#2dd4bf'; }
    else if (score >= 70) { grade = 'A'; label = 'Rất tốt'; icon = 'sparkles'; color = '#5eead4'; }
    else if (score >= 55) { grade = 'B'; label = 'Khá tốt'; icon = 'thumbs-up'; color = '#facc15'; }
    else if (score >= 40) { grade = 'C'; label = 'Trung bình'; icon = 'zap'; color = '#fb923c'; }
    else if (score >= 25) { grade = 'D'; label = 'Cần cải thiện'; icon = 'triangle-alert'; color = '#fb7185'; }
    else { grade = 'F'; label = 'Rủi ro cao'; icon = 'siren'; color = '#ef4444'; }
    scoreEl.textContent = grade;
    scoreEl.style.color = color;
    scoreEl.classList.add('health-score-ring');
    scoreEl.style.setProperty('--health-progress', `${score}%`);
    scoreEl.style.setProperty('--health-color', color);
    labelEl.textContent = `${label} (${score}/100)`;
    if (iconEl?.parentElement) iconEl.parentElement.innerHTML = iconMarkup(icon, 'health-icon');
}

// ===== Savings Goals =====
function previewGoalVND() {
    const raw = parseRawValue(document.getElementById('goalAmount').value);
    const krw = raw || 0;
    const r = exchangeRate || 18.5;
    document.getElementById('goalVndPreview').textContent = krw ? `≈ ${fmtFull(Math.round(krw * r))} ₫` : '';
}

async function addSavingsGoal() {
    const name = document.getElementById('goalName').value.trim();
    const amountKRW = parseRawValue(document.getElementById('goalAmount').value);
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
        showToast(`Mục tiêu "${name}" đã thêm!`, 'success');
    } catch (err) {
        showToast('Lỗi lưu mục tiêu: ' + err.message, 'error');
    }
}

async function deleteSavingsGoal(id) {
    try {
        await deleteGoalFromDB(id);
        savingsGoals = savingsGoals.filter(g => g.id !== id);
        renderSavingsGoals();
        showToast('Đã xóa mục tiêu', 'info');
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
                <div class="goal-name">${iconMarkup('target')} ${escapeHtml(g.name)}</div>
                <div class="goal-details">
                    <span class="goal-meta">${iconMarkup('banknote')} ${fmtKRW(g.amountKRW)} (${fmtVND(targetVND)})</span>
                    <span class="goal-meta">${iconMarkup('calendar-clock')} ${g.months} tháng</span>
                    <span class="goal-meta">${iconMarkup('circle-dollar-sign')} ${fmtKRW(monthlyNeeded)}/tháng</span>
                </div>
                <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${pct}%;${pct >= 100 ? 'background:linear-gradient(90deg,#2dd4bf,#5eead4);' : ''}"></div></div>
            </div>
            <div class="goal-pct">${pct}%</div>
            <button class="goal-delete" onclick="deleteSavingsGoal('${g.id}')" title="Xóa">${iconMarkup('trash-2')}</button>
        </div>`;
    }).join('');
}

// ===== Budget Table =====
function getBudgetKey(y, m) { return `${y}-${String(m + 1).padStart(2, '0')}`; }

function changeYear(delta) { budgetYear += delta; document.getElementById('yearLabel').textContent = budgetYear; renderAll(); }

function onIncomeInput(month, value) {
    const key = getBudgetKey(budgetYear, month);
    if (!monthlyBudget[key]) monthlyBudget[key] = {};
    monthlyBudget[key].income = parseRawValue(value);
    updateRowInline(month);
    renderWithoutTable();
    updateTableFooter();
    debounceSaveBudget(budgetYear, month, monthlyBudget[key].income, monthlyBudget[key].expense || 0);
}

function onExpenseInput(month, value) {
    const key = getBudgetKey(budgetYear, month);
    if (!monthlyBudget[key]) monthlyBudget[key] = {};
    monthlyBudget[key].expense = parseRawValue(value);
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
    const reserveFromBalance = Math.round(balance * (2/3));
    const investFromBalance = balance - reserveFromBalance;
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
        const reserveFromBalance = Math.round(balance * (2/3));
        const investFromBalance = balance - reserveFromBalance;
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
        const reserveFromBalance = Math.round(balance * (2/3));
        const investFromBalance = balance - reserveFromBalance;
        tI += inc; tL += living; tR += reserve; tV += invest; tE += exp; tS += surplus;
        tRnew += (inc || exp) ? reserveFromBalance : 0;
        tVnew += (inc || exp) ? investFromBalance : 0;
        const bC = balance >= 0 ? 'positive' : 'negative', sC = surplus >= 0 ? 'positive' : 'negative';
        const isCurrent = budgetYear === new Date().getFullYear() && m === new Date().getMonth();
        const reserveDisplay = inc ? `${fmtFull(reserve)}<span class="cell-new-val">/ ${fmtFull(reserveFromBalance)}</span>` : '-';
        const investDisplay = inc ? `${fmtFull(invest)}<span class="cell-new-val">/ ${fmtFull(investFromBalance)}</span>` : '-';
        // Extract raw number value to display normally, but formatted
        const incVal = inc ? fmtFullRaw(inc) : '';
        const expVal = exp ? fmtFullRaw(exp) : '';
        rows += `<tr${isCurrent ? ' style="background:rgba(108,92,231,0.08);"' : ''}>
            <td>${MONTHS[m]}</td>
            <td><input class="income-input" type="text" inputmode="numeric" value="${incVal}" placeholder="₩" oninput="formatInputLive(this); onIncomeInput(${m},this.value)" onfocus="this.select()"></td>
            <td class="cell-living">${inc ? fmtFull(living) : '-'}</td>
            <td class="cell-reserve">${reserveDisplay}</td>
            <td class="cell-invest">${investDisplay}</td>
            <td><input class="expense-input" type="text" inputmode="numeric" value="${expVal}" placeholder="₩" oninput="formatInputLive(this); onExpenseInput(${m},this.value)" onfocus="this.select()"></td>
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
function legacyRenderBudgetOverviewChart() {
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
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${iconMarkup('chart-no-axes-combined')}</div><p>Nhập dữ liệu để xem biểu đồ</p></div>`;
        refreshIcons();
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

function renderBudgetOverviewChart() {
    const container = document.getElementById('budgetOverviewChart');
    if (!container) return;

    const labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const series = { income: [], expense: [], balance: [] };
    const allocations = { living: 0, reserve: 0, invest: 0 };
    let hasData = false;

    for (let m = 0; m < 12; m++) {
        const key = getBudgetKey(budgetYear, m);
        const bd = monthlyBudget[key] || {};
        const inc = Number(bd.income || 0);
        const exp = Number(bd.expense || 0);
        const balance = inc - exp;

        if (inc || exp) hasData = true;
        allocations.living += Math.round(inc * 0.40);
        allocations.reserve += Math.round(inc * 0.40);
        allocations.invest += Math.round(inc * 0.20);
        series.income.push(inc);
        series.expense.push(exp);
        series.balance.push(balance);
    }

    if (!hasData) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${iconMarkup('chart-no-axes-combined')}</div><p>Nhập dữ liệu để xem biểu đồ</p></div>`;
        refreshIcons();
        return;
    }

    const W = 920;
    const H = 315;
    const pad = { top: 22, right: 24, bottom: 38, left: 60 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;

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

    function getNiceMin(v) {
        if (v >= 0) return 0;
        return -getNiceMax(Math.abs(v));
    }

    const allVals = [...series.income, ...series.expense, ...series.balance];
    const niceMax = getNiceMax(Math.max(...allVals, 1));
    const niceMin = getNiceMin(Math.min(...allVals, 0));
    const range = Math.max(1, niceMax - niceMin);
    const zeroY = yPos(0);

    function xPos(i) {
        return pad.left + (i / 11) * cW;
    }

    function yPos(v) {
        return pad.top + cH - ((v - niceMin) / range) * cH;
    }

    function pointFor(v, i) {
        return { x: Number(xPos(i).toFixed(1)), y: Number(yPos(v).toFixed(1)) };
    }

    function areaPath(points) {
        if (!points.length) return '';
        const line = makeSmoothPath(points);
        return `${line} L ${points[points.length - 1].x} ${zeroY.toFixed(1)} L ${points[0].x} ${zeroY.toFixed(1)} Z`;
    }

    let gridSvg = '';
    for (let i = 0; i <= 5; i++) {
        const val = Math.round(niceMin + (range / 5) * i);
        const y = yPos(val);
        const isZero = Math.abs(val) < range / 100;
        gridSvg += `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" class="${isZero ? 'budget-flow-zero' : 'budget-flow-grid'}"/>`;
        gridSvg += `<text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" class="budget-flow-y-label">${fmtCompact(val)}</text>`;
    }

    const xLabels = labels.map((label, i) => (
        `<text x="${xPos(i)}" y="${H - 10}" text-anchor="middle" class="budget-flow-x-label">${label}</text>`
    )).join('');

    const flowSeries = [
        { key: 'income', cls: 'income', data: series.income },
        { key: 'expense', cls: 'expense', data: series.expense },
        { key: 'balance', cls: 'balance', data: series.balance },
    ];

    let shapesSvg = '';
    let dotsSvg = '';
    let labelsSvg = '';
    let hitSvg = '';

    flowSeries.forEach(cfg => {
        const vals = cfg.data;
        const points = vals.map((value, index) => pointFor(value, index));
        const pathD = makeSmoothPath(points);

        if (cfg.key !== 'balance') {
            shapesSvg += `<path class="budget-flow-area budget-flow-area-${cfg.cls}" d="${areaPath(points)}"/>`;
        }
        shapesSvg += `<path class="budget-flow-line budget-flow-line-${cfg.cls}" d="${pathD}"/>`;

        const nonZeroIndexes = vals.map((value, index) => value !== 0 ? index : -1).filter(index => index >= 0);
        const latestIndex = nonZeroIndexes.length ? nonZeroIndexes[nonZeroIndexes.length - 1] : -1;
        const peakIndex = vals.indexOf(Math.max(...vals));

        for (let i = 0; i < vals.length; i++) {
            if (vals[i] === 0 && !series.income[i] && !series.expense[i]) continue;
            const point = points[i];
            const isKeyPoint = i === latestIndex || (cfg.key === 'income' && i === peakIndex);
            dotsSvg += `<circle cx="${point.x}" cy="${point.y}" r="${isKeyPoint ? 4.6 : 3}" class="budget-flow-dot budget-flow-dot-${cfg.cls}"/>`;
            if (isKeyPoint && vals[i] !== 0) {
                const labelY = cfg.key === 'balance' ? point.y + 17 : point.y - 12;
                labelsSvg += `<text x="${Math.min(W - 34, Math.max(34, point.x))}" y="${Math.max(16, Math.min(H - 24, labelY))}" text-anchor="middle" class="budget-flow-value budget-flow-value-${cfg.cls}">${fmtCompact(vals[i])}</text>`;
            }
        }
    });

    let curMonthSvg = '';
    if (budgetYear === new Date().getFullYear()) {
        const cx = xPos(new Date().getMonth());
        curMonthSvg = `<line x1="${cx}" y1="${pad.top}" x2="${cx}" y2="${pad.top + cH}" class="budget-flow-current"/>`;
    }

    for (let index = 0; index < labels.length; index++) {
        if (!series.income[index] && !series.expense[index]) continue;
        const x = xPos(index);
        hitSvg += `<circle cx="${x}" cy="${pad.top + cH / 2}" r="24" class="budget-flow-hit"
            onmousemove="showBudgetTooltip(event, ${index}, ${series.income[index]}, ${series.expense[index]}, ${series.balance[index]})"
            onmouseleave="hideBudgetTooltip()"></circle>`;
    }

    container.innerHTML = `<div class="budget-flow-chart">
        <div class="budget-flow-legend">
            <span class="income">Thu nhập</span>
            <span class="expense">Chi tiêu</span>
            <span class="balance">Còn lại</span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="line-chart-svg budget-flow-svg" role="img" aria-label="Biểu đồ thu nhập, chi tiêu và còn lại theo tháng">
            ${gridSvg}
            ${xLabels}
            ${curMonthSvg}
            ${shapesSvg}
            ${dotsSvg}
            ${labelsSvg}
            ${hitSvg}
        </svg>
        <div class="budget-chart-tooltip" id="budgetChartTooltip"></div>
        <div class="budget-flow-allocation">
            <span>Sinh hoạt 40% <strong>${fmtCompact(allocations.living)}</strong></span>
            <span>Dự phòng 40% <strong>${fmtCompact(allocations.reserve)}</strong></span>
            <span>Đầu tư 20% <strong>${fmtCompact(allocations.invest)}</strong></span>
        </div>
    </div>`;
}

renderBudgetOverviewChart = function() {
    const container = document.getElementById('budgetOverviewChart');
    if (!container) return;

    const labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const series = { income: [], expense: [], balance: [] };
    const allocations = { living: 0, reserve: 0, invest: 0 };
    let hasData = false;

    for (let m = 0; m < 12; m++) {
        const key = getBudgetKey(budgetYear, m);
        const bd = monthlyBudget[key] || {};
        const income = Number(bd.income || 0);
        const expense = Number(bd.expense || 0);
        const balance = income - expense;

        if (income || expense) hasData = true;
        allocations.living += Math.round(income * 0.40);
        allocations.reserve += Math.round(income * 0.40);
        allocations.invest += Math.round(income * 0.20);
        series.income.push(income);
        series.expense.push(expense);
        series.balance.push(balance);
    }

    if (!hasData) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${iconMarkup('chart-no-axes-combined')}</div><p>Nhập dữ liệu để xem biểu đồ</p></div>`;
        refreshIcons();
        return;
    }

    const W = 920;
    const H = 315;
    const pad = { top: 24, right: 24, bottom: 38, left: 60 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;

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

    const allValues = [...series.income, ...series.expense, ...series.balance];
    const niceMax = getNiceMax(Math.max(...allValues, 1));
    const niceMin = Math.min(...allValues) < 0 ? -getNiceMax(Math.abs(Math.min(...allValues))) : 0;
    const range = Math.max(1, niceMax - niceMin);
    const zeroY = yPos(0);

    function xPos(index) {
        return pad.left + (index / 11) * cW;
    }

    function yPos(value) {
        return pad.top + cH - ((value - niceMin) / range) * cH;
    }

    function pointFor(value, index) {
        return { x: Number(xPos(index).toFixed(1)), y: Number(yPos(value).toFixed(1)) };
    }

    function budgetFlowPath(points) {
        return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    }

    function areaPath(points) {
        if (!points.length) return '';
        return `${budgetFlowPath(points)} L ${points[points.length - 1].x} ${zeroY.toFixed(1)} L ${points[0].x} ${zeroY.toFixed(1)} Z`;
    }

    let gridSvg = '';
    for (let i = 0; i <= 5; i++) {
        const value = Math.round(niceMin + (range / 5) * i);
        const y = yPos(value);
        const isZero = Math.abs(value) < range / 100;
        gridSvg += `<line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" class="${isZero ? 'budget-flow-zero' : 'budget-flow-grid'}"/>`;
        gridSvg += `<text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" class="budget-flow-y-label">${fmtCompact(value)}</text>`;
    }

    const xLabels = labels.map((label, index) => (
        `<text x="${xPos(index)}" y="${H - 10}" text-anchor="middle" class="budget-flow-x-label">${label}</text>`
    )).join('');

    const chartSeries = [
        { key: 'income', cls: 'income', label: 'Thu nhập', data: series.income },
        { key: 'expense', cls: 'expense', label: 'Chi tiêu', data: series.expense },
        { key: 'balance', cls: 'balance', label: 'Còn lại', data: series.balance },
    ];

    let shapesSvg = '';
    let dotsSvg = '';
    let labelsSvg = '';
    let hitSvg = '';

    chartSeries.forEach(cfg => {
        const points = cfg.data.map((value, index) => pointFor(value, index));
        const pathD = budgetFlowPath(points);

        if (cfg.key !== 'balance') {
            shapesSvg += `<path class="budget-flow-area budget-flow-area-${cfg.cls}" d="${areaPath(points)}"/>`;
        }
        shapesSvg += `<path class="budget-flow-line budget-flow-line-${cfg.cls}" d="${pathD}"/>`;

        const nonZeroIndexes = cfg.data.map((value, index) => value !== 0 ? index : -1).filter(index => index >= 0);
        const latestIndex = nonZeroIndexes.length ? nonZeroIndexes[nonZeroIndexes.length - 1] : -1;
        const peakIndex = cfg.data.indexOf(Math.max(...cfg.data));

        cfg.data.forEach((value, index) => {
            if (value === 0 && !series.income[index] && !series.expense[index]) return;
            const point = points[index];
            const isKeyPoint = index === latestIndex || (cfg.key === 'income' && index === peakIndex);
            dotsSvg += `<circle cx="${point.x}" cy="${point.y}" r="${isKeyPoint ? 4.6 : 3}" class="budget-flow-dot budget-flow-dot-${cfg.cls}"><title>${cfg.label}: ${fmtFull(value)} KRW</title></circle>`;
            if (isKeyPoint && value !== 0) {
                const labelY = cfg.key === 'balance' ? point.y + 17 : point.y - 12;
                labelsSvg += `<text x="${Math.min(W - 34, Math.max(34, point.x))}" y="${Math.max(16, Math.min(H - 24, labelY))}" text-anchor="middle" class="budget-flow-value budget-flow-value-${cfg.cls}">${fmtCompact(value)}</text>`;
            }
        });
    });

    let curMonthSvg = '';
    if (budgetYear === new Date().getFullYear()) {
        const cx = xPos(new Date().getMonth());
        curMonthSvg = `<line x1="${cx}" y1="${pad.top}" x2="${cx}" y2="${pad.top + cH}" class="budget-flow-current"/>`;
    }

    for (let index = 0; index < labels.length; index++) {
        if (!series.income[index] && !series.expense[index]) continue;
        const x = xPos(index);
        hitSvg += `<circle cx="${x}" cy="${pad.top + cH / 2}" r="24" class="budget-flow-hit"
            onmousemove="showBudgetTooltip(event, ${index}, ${series.income[index]}, ${series.expense[index]}, ${series.balance[index]})"
            onmouseleave="hideBudgetTooltip()"></circle>`;
    }

    container.innerHTML = `<div class="budget-flow-chart">
        <div class="budget-flow-legend">
            <span class="income">Thu nhập</span>
            <span class="expense">Chi tiêu</span>
            <span class="balance">Còn lại</span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="line-chart-svg budget-flow-svg" role="img" aria-label="Biểu đồ thu nhập, chi tiêu và còn lại theo tháng">
            ${gridSvg}
            ${xLabels}
            ${curMonthSvg}
            ${shapesSvg}
            ${dotsSvg}
            ${labelsSvg}
            ${hitSvg}
        </svg>
        <div class="budget-chart-tooltip" id="budgetChartTooltip"></div>
        <div class="budget-flow-allocation">
            <span>Sinh hoạt 40% <strong>${fmtCompact(allocations.living)}</strong></span>
            <span>Dự phòng 40% <strong>${fmtCompact(allocations.reserve)}</strong></span>
            <span>Đầu tư 20% <strong>${fmtCompact(allocations.invest)}</strong></span>
        </div>
    </div>`;
};

// ===== Chart Fullscreen =====
function openChartFullscreen() {
    const chart = document.getElementById('budgetOverviewChart');
    const overlay = document.getElementById('chartFullscreen');
    const content = document.getElementById('chartFullscreenContent');
    if (!chart || !overlay || !content) return;
    if (!chart.innerHTML.trim()) { showToast('Chưa có biểu đồ để phóng to', 'info'); return; }
    content.innerHTML = chart.innerHTML;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeChartFullscreen(e) {
    if (e && e.target !== document.getElementById('chartFullscreen')) return;
    const overlay = document.getElementById('chartFullscreen');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ===== Pie Charts =====
function renderPieCharts() {
    document.getElementById('pieYearLabel').textContent = budgetYear;
    
    // 1. Calculate Yearly Data
    let yInc = 0, yExp = 0;
    for (let m = 0; m < 12; m++) {
        const key = getBudgetKey(budgetYear, m);
        const data = monthlyBudget[key] || {};
        yInc += Number(data.income || 0);
        yExp += Number(data.expense || 0);
    }
    const yBal = Math.max(0, yInc - yExp);
    const yRes = Math.round(yBal * (2/3));
    const yInv = yBal - yRes;
    
    // 2. Calculate All-Time Data
    let aInc = 0, aExp = 0;
    Object.values(monthlyBudget).forEach(b => {
        aInc += Number(b.income || 0);
        aExp += Number(b.expense || 0);
    });
    const aBal = Math.max(0, aInc - aExp);
    const aRes = Math.round(aBal * (2/3));
    const aInv = aBal - aRes;

    const yearlyData = [
        { label: 'Chi tiêu', value: yExp, color: '#e74c3c' },
        { label: 'Dự phòng', value: yRes, color: '#f39c12' },
        { label: 'Đầu tư', value: yInv, color: '#00cec9' }
    ];
    drawPie('pieChartYearly', yearlyData);
    document.getElementById('pieLegendYearly').innerHTML = getPieLegendHTML(yearlyData);

    const allTimeData = [
        { label: 'Chi tiêu', value: aExp, color: '#e74c3c' },
        { label: 'Dự phòng', value: aRes, color: '#f39c12' },
        { label: 'Đầu tư', value: aInv, color: '#00cec9' }
    ];
    drawPie('pieChartAllTime', allTimeData);
    document.getElementById('pieLegendAllTime').innerHTML = getPieLegendHTML(allTimeData);
}

function getPieLegendHTML(data) {
    return data.map(item => `
        <div class="pie-legend-item">
            <span class="legend-dot" style="background:${item.color}"></span> 
            ${item.label}: <strong>${fmtFull(item.value)} ₩</strong>
        </div>
    `).join('');
}

function drawPie(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) {
        container.innerHTML = '<div class="pie-empty">Chưa có dữ liệu</div>';
        return;
    }

    let svg = '<svg viewBox="-1 -1 2 2" class="pie-chart-svg">';
    let cumulativePercent = 0;

    data.forEach(slice => {
        const percent = slice.value / total;
        if (percent === 0) return;
        
        // If one slice is 100%, draw a full circle
        if (percent === 1) {
            svg += `<circle cx="0" cy="0" r="1" fill="${slice.color}" class="pie-slice"><title>${slice.label}: 100%</title></circle>`;
            return;
        }

        const startX = Math.cos(2 * Math.PI * cumulativePercent);
        const startY = Math.sin(2 * Math.PI * cumulativePercent);
        
        cumulativePercent += percent;
        
        const endX = Math.cos(2 * Math.PI * cumulativePercent);
        const endY = Math.sin(2 * Math.PI * cumulativePercent);
        const largeArcFlag = percent > 0.5 ? 1 : 0;
        
        const pathData = [
            `M ${startX} ${startY}`, // Move to edge
            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Draw arc
            `L 0 0`, // Line to center
        ].join(' ');
        
        svg += `<path d="${pathData}" fill="${slice.color}" class="pie-slice"><title>${slice.label}: ${(percent * 100).toFixed(1)}%</title></path>`;
    });

    svg += '</svg>';
    container.innerHTML = svg;
}

function getAllocationLegendHTML(data) {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    return data.map(item => {
        const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return `<div class="pie-legend-item allocation-legend-item">
            <span class="legend-dot" style="background:${item.color}"></span>
            ${item.label}: <strong>${percent}%</strong>
        </div>`;
    }).join('');
}

function drawAllocationBars(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) {
        container.innerHTML = '<div class="pie-empty allocation-empty">Chưa có dữ liệu</div>';
        return;
    }

    const rows = data.map(item => {
        const percent = Math.round((item.value / total) * 100);
        return `<div class="allocation-bar-row">
            <div class="allocation-bar-heading">
                <span><i style="background:${item.color}"></i>${item.label}</span>
                <strong>${percent}%</strong>
            </div>
            <div class="allocation-bar-track">
                <div class="allocation-bar-fill" style="--bar-width:${percent}%; --bar-color:${item.color}"></div>
            </div>
            <div class="allocation-bar-value">${fmtFull(item.value)} KRW</div>
        </div>`;
    }).join('');

    container.innerHTML = `<div class="allocation-bar-chart">${rows}</div>`;
}

renderPieCharts = function() {
    const yearLabel = document.getElementById('pieYearLabel');
    if (yearLabel) yearLabel.textContent = budgetYear;

    let yearlyIncome = 0;
    let yearlyExpense = 0;
    for (let m = 0; m < 12; m++) {
        const key = getBudgetKey(budgetYear, m);
        const data = monthlyBudget[key] || {};
        yearlyIncome += Number(data.income || 0);
        yearlyExpense += Number(data.expense || 0);
    }

    let allIncome = 0;
    let allExpense = 0;
    Object.values(monthlyBudget).forEach(data => {
        allIncome += Number(data.income || 0);
        allExpense += Number(data.expense || 0);
    });

    const yearlyBalance = Math.max(0, yearlyIncome - yearlyExpense);
    const yearlyReserve = Math.round(yearlyBalance * (2 / 3));
    const yearlyInvest = yearlyBalance - yearlyReserve;
    const allBalance = Math.max(0, allIncome - allExpense);
    const allReserve = Math.round(allBalance * (2 / 3));
    const allInvest = allBalance - allReserve;

    const yearlyData = [
        { label: 'Chi tiêu', value: yearlyExpense, color: '#fb7185' },
        { label: 'Dự phòng', value: yearlyReserve, color: '#fbbf24' },
        { label: 'Đầu tư', value: yearlyInvest, color: '#2dd4bf' }
    ];
    const allTimeData = [
        { label: 'Chi tiêu', value: allExpense, color: '#fb7185' },
        { label: 'Dự phòng', value: allReserve, color: '#fbbf24' },
        { label: 'Đầu tư', value: allInvest, color: '#2dd4bf' }
    ];

    drawAllocationBars('pieChartYearly', yearlyData);
    drawAllocationBars('pieChartAllTime', allTimeData);

    const yearlyLegend = document.getElementById('pieLegendYearly');
    const allTimeLegend = document.getElementById('pieLegendAllTime');
    if (yearlyLegend) yearlyLegend.innerHTML = getAllocationLegendHTML(yearlyData);
    if (allTimeLegend) allTimeLegend.innerHTML = getAllocationLegendHTML(allTimeData);
};

// ===== Export CSV =====
function exportToCSV() {
    try {
        const rows = [
            ['Năm', 'Tháng', 'Thu Nhập (₩)', 'Sinh hoạt (₩)', 'Dự Phòng Từ Còn Lại (₩)', 'Đầu Tư Từ Còn Lại (₩)', 'Chi Tiêu Thực Tế (₩)', 'Còn Lại (₩)']
        ];

        let totalInc = 0, totalLiving = 0, totalReserve = 0, totalInvest = 0, totalExp = 0, totalBalance = 0;

        // Sort keys chronologically
        const keys = Object.keys(monthlyBudget).sort();
        
        keys.forEach(key => {
            const [y, mStr] = key.split('-');
            const m = parseInt(mStr, 10);
            const data = monthlyBudget[key];
            const inc = Number(data.income || 0);
            const exp = Number(data.expense || 0);
            
            if (inc === 0 && exp === 0) return; // Skip completely empty months
            
            const living = Math.round(inc * 0.40);
            const balance = inc - exp;
            const balPositive = Math.max(0, balance);
            const reserve = Math.round(balPositive * (2/3));
            const invest = balPositive - reserve;
            
            // Accumulate totals
            totalInc += inc;
            totalLiving += living;
            totalReserve += reserve;
            totalInvest += invest;
            totalExp += exp;
            totalBalance += balance;
            
            rows.push([
                y, 
                `Tháng ${m}`, 
                inc.toLocaleString('vi-VN'), 
                living.toLocaleString('vi-VN'), 
                reserve.toLocaleString('vi-VN'), 
                invest.toLocaleString('vi-VN'), 
                exp.toLocaleString('vi-VN'), 
                balance.toLocaleString('vi-VN')
            ]);
        });

        if (rows.length === 1) {
            showToast('Không có dữ liệu để xuất', 'info');
            return;
        }

        // Add TOTAL row
        rows.push([
            'TỔNG CỘNG',
            '',
            totalInc.toLocaleString('vi-VN'),
            totalLiving.toLocaleString('vi-VN'),
            totalReserve.toLocaleString('vi-VN'),
            totalInvest.toLocaleString('vi-VN'),
            totalExp.toLocaleString('vi-VN'),
            totalBalance.toLocaleString('vi-VN')
        ]);

        if (rows.length === 1) {
            showToast('Không có dữ liệu để xuất', 'info');
            return;
        }

        // Mẹo cho Excel: Thêm BOM để hiển thị đúng Tiếng Việt, không cần sep=, nếu dùng dấu phẩy mặc định
        const csvContent = "\uFEFF" + rows.map(r => {
            // Bao bọc các giá trị trong ngoặc kép để tránh dính lỗi
            return r.map(cell => `"${cell}"`).join(',');
        }).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `TaichinhGOZ_Backup_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Đã xuất báo cáo CSV thành công!', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showToast('Lỗi xuất file: ' + err.message, 'error');
    }
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
