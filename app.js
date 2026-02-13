/**
 * 표준 노후 은퇴 계산기 로직
 */

const inputs = {
    currentAge: document.getElementById('currentAge'),
    targetAge: document.getElementById('targetAge'),
    currentSavings: document.getElementById('currentSavings'),
    annualContribution: document.getElementById('annualContribution'),
    annualIncome: document.getElementById('annualIncome'),
    annualExpenses: document.getElementById('annualExpenses'),
    expectedReturn: document.getElementById('inputExpectedReturn'),
    inflationRate: document.getElementById('inputInflationRate'),
    swr: document.getElementById('inputSWR')
};

const sliders = {
    expectedReturn: document.getElementById('sliderExpectedReturn'),
    inflationRate: document.getElementById('sliderInflationRate'),
    swr: document.getElementById('sliderSWR')
};

const displays = {
    fireNumber: document.getElementById('resFireNumber'),
    yearsToFire: document.getElementById('resYearsToFire'),
    ageAtFire: document.getElementById('resAgeAtFire'),
    savingsRate: document.getElementById('resSavingsRate'),
    contribPerMonth: document.getElementById('resContribPerMonth'),
    percProgress: document.getElementById('percProgress'),
    yearsToGo: document.getElementById('yearsToGo'),
    progressBar: document.getElementById('progressBar'),
    progressCurrent: document.getElementById('progressCurrent'),
    progressTarget: document.getElementById('progressTarget'),
    understandingText: document.getElementById('understandingText'),
    statusMessage: document.getElementById('statusMessage')
};

const toggles = {
    contribution: { mode: 'annual', btn: document.querySelector('[data-target="contribution"]'), suffix: document.getElementById('contribSuffix') },
    income: { mode: 'annual', btn: document.querySelector('[data-target="income"]'), suffix: document.getElementById('incomeSuffix') },
    expenses: { mode: 'annual', btn: document.querySelector('[data-target="expenses"]'), suffix: document.getElementById('expenseSuffix') }
};

let fireChart = null;

// 천단위 콤마 포맷터
function formatWithCommas(str) {
    const val = str.toString().replace(/[^0-9]/g, '');
    if (val === '') return '';
    return Number(val).toLocaleString('ko-KR');
}

// 콤마 제거 파서
function parseFormattedValue(str) {
    return parseFloat(str.toString().replace(/,/g, '')) || 0;
}

// 한글 금액 포맷터 (억/만 단위 사용)
function formatKoreanCurrency(value) {
    if (value === 0) return '0원';

    if (value >= 100000000) {
        const eok = Math.floor(value / 100000000);
        const man = Math.floor((value % 100000000) / 10000);
        return man > 0 ? `${eok.toLocaleString()}억 ${man.toLocaleString()}만원` : `${eok.toLocaleString()}억원`;
    } else if (value >= 10000) {
        const man = Math.floor(value / 10000);
        return `${man.toLocaleString()}만원`;
    }
    return `${Math.floor(value).toLocaleString()}원`;
}

function formatCompact(value) {
    if (value >= 100000000) return (value / 100000000).toFixed(1) + '억';
    if (value >= 10000) return (value / 10000).toFixed(0) + '만';
    return value.toLocaleString();
}

// 단위 토글 처리
function handleToggle(key) {
    const t = toggles[key];
    const input = document.getElementById(`annual${key.charAt(0).toUpperCase() + key.slice(1)}`);
    let val = parseFormattedValue(input.value);

    if (t.mode === 'annual') {
        t.mode = 'monthly';
        input.value = Math.round(val / 12).toLocaleString('ko-KR');
        t.suffix.textContent = '천원/월';
    } else {
        t.mode = 'annual';
        input.value = Math.round(val * 12).toLocaleString('ko-KR');
        t.suffix.textContent = '천원/년';
    }
    calculateFIRE();
}

/**
 * 계산 핵심 로직
 */
function calculateFIRE() {
    const currentAge = parseInt(inputs.currentAge.value) || 0;
    // 단위가 '천원'이므로 1000을 곱함
    const currentSavings = parseFormattedValue(inputs.currentSavings.value) * 1000;

    const annContribution = (parseFormattedValue(inputs.annualContribution.value) || 0) * (toggles.contribution.mode === 'monthly' ? 12 : 1) * 1000;
    const annIncome = (parseFormattedValue(inputs.annualIncome.value) || 0) * (toggles.income.mode === 'monthly' ? 12 : 1) * 1000;
    const annExpenses = (parseFormattedValue(inputs.annualExpenses.value) || 0) * (toggles.expenses.mode === 'monthly' ? 12 : 1) * 1000;

    const nominalReturn = (parseFloat(inputs.expectedReturn.value) || 0) / 100;
    const inflation = (parseFloat(inputs.inflationRate.value) || 0) / 100;
    const realReturn = nominalReturn - inflation;
    const swr = (parseFloat(inputs.swr.value) || 0) / 100;

    // 1. 목표 금액 계산
    const fireNumber = swr > 0 ? annExpenses / swr : 0;
    displays.fireNumber.textContent = formatKoreanCurrency(fireNumber);
    displays.progressTarget.textContent = formatKoreanCurrency(fireNumber);
    displays.progressCurrent.textContent = formatKoreanCurrency(currentSavings);

    // 2. 저축률 계산
    const savingsRate = annIncome > 0 ? (annContribution / annIncome) * 100 : 0;
    displays.savingsRate.textContent = savingsRate.toFixed(1) + '%';
    displays.contribPerMonth.textContent = `월 ${formatKoreanCurrency(annContribution / 12)} 저축 중`;

    // 3. 자산 성장 시뮬레이션
    let balance = currentSavings;
    let balanceAdjusted = currentSavings;
    let age = currentAge;
    let fireAge = null;

    const labels = [];
    const balances = [];
    const balancesAdjusted = [];
    const targetLine = [];

    labels.push(age);
    balances.push(balance);
    balancesAdjusted.push(balanceAdjusted);
    targetLine.push(fireNumber);

    const maxYears = 100 - currentAge;
    for (let i = 1; i <= maxYears; i++) {
        balance = balance * (1 + nominalReturn) + annContribution;
        balanceAdjusted = balanceAdjusted * (1 + realReturn) + annContribution;

        age++;
        labels.push(age);
        balances.push(Math.round(balance));
        balancesAdjusted.push(Math.round(balanceAdjusted));
        targetLine.push(fireNumber);

        if (fireAge === null && balanceAdjusted >= fireNumber) {
            fireAge = age;
        }
    }

    // 4. 결과 지표 업데이트
    if (fireAge) {
        const yearsToFire = fireAge - currentAge;
        displays.yearsToFire.textContent = yearsToFire + '년';
        displays.ageAtFire.textContent = `${fireAge}세에 목표 달성 예상`;
        displays.yearsToGo.textContent = `은퇴까지 약 ${yearsToFire}년 남았습니다`;
        displays.statusMessage.textContent = '은퇴 목표를 향해 나아가고 있습니다!';
    } else {
        displays.yearsToFire.textContent = '계산 불가';
        displays.ageAtFire.textContent = '현재 조건으로는 도달이 어렵습니다';
        displays.yearsToGo.textContent = '추가 저축이나 수익률 제고가 필요합니다';
        displays.statusMessage.textContent = '계획 수정이 필요해 보입니다.';
    }

    // 5. 진행률 바
    const progress = fireNumber > 0 ? Math.min((currentSavings / fireNumber) * 100, 100) : 0;
    displays.percProgress.textContent = progress.toFixed(1) + '%';
    displays.progressBar.style.width = progress + '%';

    // 6. 상세 진단 내용
    displays.understandingText.innerHTML = `
        <p>고객님의 <strong>은퇴 목표 금액(${formatKoreanCurrency(fireNumber)})</strong>은 연간 생활비(${formatKoreanCurrency(annExpenses)})를 안전 인출률(${(swr * 100).toFixed(1)}%)로 나누어 계산되었습니다.</p>
        <p>현재의 저축 속도와 투자 수익률을 유지하신다면, 앞으로 약 <strong>${fireAge ? (fireAge - currentAge) : '...'}년 후</strong>인 <strong>${fireAge ? fireAge : '...'}세</strong>에 경제적 자유를 얻으실 것으로 보입니다.</p>
        <p>그래프의 실선은 자산의 명목 성장을, 점선은 물가 상승을 고려한 실제 구매력을 나타냅니다. 붉은색 점선은 고객님이 은퇴를 위해 반드시 달성해야 할 목표선입니다.</p>
    `;

    updateChart(labels, balances, balancesAdjusted, fireNumber);
}

function updateChart(labels, balances, balancesAdjusted, target) {
    const ctx = document.getElementById('fireChart').getContext('2d');

    if (fireChart) fireChart.destroy();

    fireChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '예상 자산 가치',
                    data: balances,
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0
                },
                {
                    label: '물가 반영 실질 가치',
                    data: balancesAdjusted,
                    borderColor: '#6366f1',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0
                },
                {
                    label: '은퇴 목표선',
                    data: labels.map(() => target),
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderDash: [2, 2],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Noto Sans KR' } }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatKoreanCurrency(ctx.raw)}`
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (val) => formatCompact(val)
                    }
                },
                x: {
                    title: { display: true, text: '나이 (세)', font: { family: 'Noto Sans KR' } }
                }
            }
        }
    });
}

// 금액 자동 콤마 포맷팅 적용
document.querySelectorAll('.monetary-input').forEach(input => {
    input.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const oldLen = e.target.value.length;
        e.target.value = formatWithCommas(e.target.value);
        const newLen = e.target.value.length;

        // 커서 위치 유지
        const newStart = start + (newLen - oldLen);
        e.target.setSelectionRange(newStart, newStart);

        calculateFIRE();
        saveState();
    });
});

// 슬라이더-입력창 동기화
function setupSync(input, slider) {
    input.addEventListener('input', () => {
        slider.value = input.value;
        calculateFIRE();
        saveState();
    });
    slider.addEventListener('input', () => {
        input.value = slider.value;
        calculateFIRE();
        saveState();
    });
}

// 빠른 설정 (프리셋)
document.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', () => {
        const type = card.dataset.type;

        switch (type) {
            case 'conservative':
                inputs.annualContribution.value = '10,000';
                inputs.annualIncome.value = '72,000';
                inputs.expectedReturn.value = 6;
                sliders.expectedReturn.value = 6;
                break;
            case 'moderate':
                inputs.annualContribution.value = '18,000';
                inputs.annualIncome.value = '72,000';
                inputs.expectedReturn.value = 7;
                sliders.expectedReturn.value = 7;
                break;
            case 'aggressive':
                inputs.annualContribution.value = '36,000';
                inputs.annualIncome.value = '72,000';
                inputs.expectedReturn.value = 7;
                sliders.expectedReturn.value = 7;
                break;
            case 'fatfire':
                inputs.annualContribution.value = '60,000';
                inputs.annualIncome.value = '150,000';
                inputs.annualExpenses.value = '100,000';
                break;
        }
        calculateFIRE();
        saveState();
    });
});

// 초기화
document.getElementById('btnReset').addEventListener('click', () => {
    localStorage.removeItem('fire_calc_state_korean_v2');
    window.location.href = window.location.pathname;
});

// 저장 및 불러오기
function saveState() {
    const state = {};
    Object.keys(inputs).forEach(key => state[key] = inputs[key].value);
    localStorage.setItem('fire_calc_state_korean_v2', JSON.stringify(state));
}

function loadState() {
    const saved = JSON.parse(localStorage.getItem('fire_calc_state_korean_v2') || '{}');
    Object.keys(inputs).forEach(key => {
        if (saved[key]) {
            inputs[key].value = saved[key];
            if (sliders[key]) sliders[key].value = saved[key];
        }
    });
}

// 초기 실행
Object.keys(toggles).forEach(key => {
    if (toggles[key].btn) {
        toggles[key].btn.addEventListener('click', () => handleToggle(key));
    }
});

setupSync(inputs.expectedReturn, sliders.expectedReturn);
setupSync(inputs.inflationRate, sliders.inflationRate);
setupSync(inputs.swr, sliders.swr);

// 일반 입력창(텍스트/숫자) 변경 시 계산
Object.values(inputs).forEach(el => {
    if (!el.classList.contains('monetary-input')) {
        el.addEventListener('input', () => {
            calculateFIRE();
            saveState();
        });
    }
});

loadState();
calculateFIRE();
