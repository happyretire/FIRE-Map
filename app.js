const inputs = {
    currentAge: document.getElementById('currentAge'),
    targetAge: document.getElementById('targetAge'),
    lifeExpectancy: document.getElementById('lifeExpectancy'),
    currentSavings: document.getElementById('currentSavings'),
    annualContribution: document.getElementById('annualContribution'),
    annualIncome: document.getElementById('annualIncome'),
    annualExpenses: document.getElementById('annualExpenses'),
    monthlyPension: document.getElementById('monthlyPension'),
    expectedReturn: document.getElementById('sliderExpectedReturn'),
    inflationRate: document.getElementById('sliderInflationRate')
};
const sliders = {
    expectedReturn: document.getElementById('sliderExpectedReturn'),
    inflationRate: document.getElementById('sliderInflationRate'),
    depletionRate: document.getElementById('sliderDepletionRate')
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

let fireChart = null;
let futureExpenses = [];

/**
 * Utility: Debounce function to prevent excessive persistence
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

const debouncedSave = debounce(() => {
    saveState();
}, 1000); // 1 second debounce for saving to localStorage

/**
 * High-performance UI update using requestAnimationFrame
 */
let updateScheduled = false;
function triggerUpdate() {
    if (updateScheduled) return;
    updateScheduled = true;
    requestAnimationFrame(() => {
        calculateFIRE();
        debouncedSave();
        updateScheduled = false;
    });
}

/**
 * 재무 함수: PV (Present Value)
 * @param {number} rate 실질 수익률 (0.04 등)
 * @param {number} nper 기간 (년)
 * @param {number} pmt 연간 인출액
 * @param {number} fv 기말 잔액 목표
 */
function calculatePV(rate, nper, pmt, fv = 0) {
    if (nper <= 0) return fv;
    if (Math.abs(rate) < 0.0001) return pmt * nper + fv;

    // PV = (PMT * (1 - (1+r)^-n) / r) + (FV / (1+r)^n)
    const pvFactor = (1 - Math.pow(1 + rate, -nper)) / rate;
    const fvFactor = 1 / Math.pow(1 + rate, nper);
    return (pmt * pvFactor) + (fv * fvFactor);
}

// 천단위 콤마 포맷터
function formatWithCommas(str) {
    const val = str.toString().replace(/[^0-9]/g, '');
    return val === '' ? '' : Number(val).toLocaleString('ko-KR');
}

// 콤마 제거 파서
function parseFormattedValue(str) {
    if (!str) return 0;
    return parseFloat(str.toString().replace(/,/g, '')) || 0;
}



// 한글 금액 포맷터 (억/만 단위 사용)
function formatKoreanCurrency(value) {
    const absValue = Math.abs(value);
    if (absValue === 0) return '0원';

    let result = '';
    if (absValue >= 100000000) {
        const eok = Math.floor(absValue / 100000000);
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

/**
 * UI 상태 제어: 모델별 슬라이더 프리셋 동기화
 */
function updateUIState(e) {
    const selectedModel = document.querySelector('input[name="retireModel"]:checked').value;
    const slider = sliders.depletionRate;

    if (e && e.type === 'change') {
        const presets = { 'preservation': 100, 'depletion': 0, 'partial': 50 };
        if (presets[selectedModel] !== undefined) {
            slider.value = 100 - presets[selectedModel];
            updateTooltip('sliderDepletionRate', 'tooltipDepletionRate', true);
        }
    }

    triggerUpdate();
}

/**
 * 계산 핵심 로직
 */
function calculateFIRE() {
    // 1. 입력값 파싱 및 기본 변수 설정
    const currentAge = parseInt(inputs.currentAge.value) || 0;
    const targetAge = Math.max(currentAge, parseInt(inputs.targetAge.value) || 0);
    const lifeExpectancy = Math.max(targetAge, parseInt(inputs.lifeExpectancy.value) || 95);
    const currentSavings = parseFormattedValue(inputs.currentSavings.value) * 1000;

    const monthlyIncome = (parseFormattedValue(inputs.annualIncome.value) * 1000) / 12;
    const monthlyContribution = parseFormattedValue(inputs.annualContribution.value) * 1000;
    const monthlyExpenses = parseFormattedValue(inputs.annualExpenses.value) * 1000;
    const monthlyPension = parseFormattedValue(inputs.monthlyPension.value) * 1000;

    const nominalReturn = (parseFloat(inputs.expectedReturn.value) || 0) / 100;
    const inflation = (parseFloat(inputs.inflationRate.value) || 0) / 100;
    const realReturn = nominalReturn - inflation;

    const preservationRate = (100 - (parseInt(sliders.depletionRate.value) || 0)) / 100;

    // 2. 목표 금액(Fire Number) 계산
    const monthlyGap = Math.max(0, monthlyExpenses - monthlyPension);
    const annualGap = monthlyGap * 12;
    const retiredYears = lifeExpectancy - targetAge;

    // 원본 유지 목표 금액 (4% 법칙 등 실질수익률 기반)
    const preservationTarget = realReturn > 0 ? annualGap / realReturn : annualGap * 25;
    const finalBalanceAtEnd = preservationTarget * preservationRate;

    let fireNumber = calculatePV(realReturn, retiredYears, annualGap, finalBalanceAtEnd);

    // 모든 미래 목돈 수입/지출을 은퇴 시점(targetAge) 가치로 환산하여 목표 금액 조정
    // 수입(+)이면 목표치가 낮아지고, 지출(-)이면 목표치가 높아짐
    futureExpenses.forEach(exp => {
        const yearsToTarget = targetAge - exp.age;
        // FV = PV * (1 + r)^n 로직을 사용하여 은퇴 시점 가치 합산 (n이 음수면 할인)
        fireNumber -= exp.amount * Math.pow(1 + realReturn, yearsToTarget);
    });

    // UI 업데이트 (목표 금액)
    displays.fireNumber.textContent = formatKoreanCurrency(Math.max(0, fireNumber));
    displays.progressTarget.textContent = formatKoreanCurrency(Math.max(0, fireNumber));
    displays.progressCurrent.textContent = formatKoreanCurrency(currentSavings);

    // 저축률 계산
    const savingsRate = monthlyIncome > 0 ? (monthlyContribution / monthlyIncome) * 100 : 0;
    displays.savingsRate.textContent = savingsRate.toFixed(1) + '%';
    displays.contribPerMonth.textContent = `월 ${formatKoreanCurrency(monthlyContribution)} 저축 중`;

    // 3. 자산 성장 시뮬레이션 및 데이터 준비
    const labels = [];
    const balances = [];
    const balancesAdjusted = [];
    const targetLine = [];

    let balance = currentSavings;
    let balanceAdjusted = currentSavings;
    let fireAge = null;

    const maxSimAge = Math.max(100, lifeExpectancy);

    for (let age = currentAge; age <= maxSimAge; age++) {
        labels.push(age);
        balances.push(Math.round(balance));
        balancesAdjusted.push(Math.round(balanceAdjusted));
        targetLine.push(Math.round(fireNumber));

        // 은퇴 가능 시점 체크 (실질 가치 기준)
        if (fireAge === null && balanceAdjusted >= fireNumber && age <= targetAge) {
            fireAge = age;
        }

        // 목돈 수입/지출 처리 (해당 나이 초입에 반영한다고 가정)
        futureExpenses.forEach(exp => {
            if (exp.age === age) {
                balance += exp.amount;
                balanceAdjusted += exp.amount;
            }
        });

        // 다음 해 자산 계산
        const isWorking = age < targetAge;
        if (isWorking) {
            balance = balance * (1 + nominalReturn) + (monthlyContribution * 12);
            balanceAdjusted = balanceAdjusted * (1 + realReturn) + (monthlyContribution * 12);
        } else {
            balance = balance * (1 + nominalReturn) - annualGap;
            balanceAdjusted = balanceAdjusted * (1 + realReturn) - annualGap;
        }
    }

    // 4. 결과 지표 업데이트
    updateResultIndicators(fireAge, targetAge, currentAge, fireNumber, balanceAdjusted, currentSavings);

    // 5. 진단 메시지 업데이트
    updateDiagnosisText(preservationRate, lifeExpectancy, targetAge, monthlyGap, fireNumber, currentSavings);

    // 6. 차트 업데이트
    updateChart(labels, balances, balancesAdjusted, fireNumber);
}

function updateResultIndicators(fireAge, targetAge, currentAge, fireNumber, finalBalanceAdjusted, currentSavings) {
    if (fireAge !== null) {
        const yearsToFire = fireAge - currentAge;
        displays.yearsToFire.textContent = yearsToFire + '년';
        displays.ageAtFire.textContent = `${fireAge}세에 조달 완료 예상`;
        displays.yearsToGo.textContent = `목표 은퇴일(${targetAge}세)까지 넉넉합니다`;
        displays.statusMessage.textContent = '현재 계획대로면 조기 은퇴도 가능해 보입니다!';
    } else {
        // 목표 나이 시점의 예상 자산 확인 (시뮬레이션 루프의 중간 데이터가 필요하므로 로직 분리 가능하나 단순화)
        // 여기서는 편의상 "도달 부족"으로 표시
        if (currentSavings >= fireNumber) {
            displays.yearsToFire.textContent = '0년';
            displays.ageAtFire.textContent = '목표 조달 완료';
            displays.yearsToGo.textContent = '이미 충분한 자산을 확보하셨습니다';
            displays.statusMessage.textContent = '축하합니다! 경제적 자유를 이루셨습니다.';
        } else {
            displays.yearsToFire.textContent = '도달 부족';
            displays.ageAtFire.textContent = `${targetAge}세 시점에 부족 예상`;
            displays.yearsToGo.textContent = '저축액을 높이거나 목표를 조정해 보세요';
            displays.statusMessage.textContent = '목표 달성을 위해 조금 더 분발이 필요합니다.';
        }
    }

    const progress = fireNumber > 0 ? Math.min((currentSavings / fireNumber) * 100, 100) : 0;
    displays.percProgress.textContent = progress.toFixed(1) + '%';
    displays.progressBar.style.width = progress + '%';
}

function updateDiagnosisText(rate, lifeExpectancy, targetAge, monthlyGap, fireNumber, currentSavings) {
    let modelName = "";
    const currentRate = rate * 100;

    if (currentRate === 100) modelName = "원금 보존 모델";
    else if (currentRate === 0) modelName = "원금 완전 고갈 모델";
    else modelName = `원금 일부 고갈 모델 (${currentRate}% 유지)`;

    const progress = fireNumber > 0 ? (currentSavings / fireNumber) * 100 : 0;

    displays.understandingText.innerHTML = `
        <p>선택하신 전략은 <strong>'${modelName}'</strong>입니다.</p>
        <p>은퇴 후 월 부족분(${formatKoreanCurrency(monthlyGap)})을 충당하며 <strong>${lifeExpectancy}세</strong>까지 자산을 유지하기 위해 
        은퇴 시점(${targetAge}세)에 총 <strong>${formatKoreanCurrency(Math.max(0, fireNumber))}</strong>가 필요합니다.</p>
        <p>현재의 저축 페이스와 미래 계획을 유지할 경우, 목표 자산의 <strong>${progress.toFixed(1)}%</strong>를 확보하신 상태입니다.</p>
    `;
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
                    label: '예상 자산 (명목)',
                    data: balances,
                    borderColor: '#0ea5e9',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0
                },
                {
                    label: '실질 가치 (물가 반영)',
                    data: balancesAdjusted,
                    borderColor: '#0284c7',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0
                },
                {
                    label: '목표선',
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
                legend: { position: 'bottom', labels: { font: { family: 'Noto Sans KR' } } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatKoreanCurrency(ctx.raw)}` }
                }
            },
            scales: {
                y: { ticks: { callback: (val) => formatCompact(val) } },
                x: { title: { display: true, text: '나이 (세)', font: { family: 'Noto Sans KR' } } }
            }
        }
    });
}

// 미래 목돈 수입/지출 관리
function updateExpensesUI() {
    const list = document.getElementById('futureExpensesList');
    list.innerHTML = '';
    futureExpenses.forEach((exp, index) => {
        const item = document.createElement('div');
        item.className = 'expense-item';
        item.style = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.85rem; padding: 6px 10px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 6px;';

        const isIncome = exp.amount > 0;
        const color = isIncome ? '#16a34a' : '#dc2626';
        const bgColor = isIncome ? '#f0fdf4' : '#fef2f2';
        const sign = isIncome ? '+' : '';
        const icon = isIncome ? 'trending-up' : 'trending-down';

        item.style.background = bgColor;
        item.style.borderColor = isIncome ? '#dcfce7' : '#fee2e2';

        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <i data-lucide="${icon}" size="14" style="color: ${color}"></i>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 600; color: #334155;">${exp.name} (${exp.age}세)</span>
                    <span style="color: ${color}; font-size: 0.8rem; font-weight: 500;">${sign}${formatKoreanCurrency(Math.abs(exp.amount))}</span>
                </div>
            </div>
            <button onclick="removeExpense(${index})" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px;">
                <i data-lucide="x" size="14"></i>
            </button>
        `;
        list.appendChild(item);
    });
    if (window.lucide) window.lucide.createIcons();
}

window.removeExpense = function (index) {
    futureExpenses.splice(index, 1);
    updateExpensesUI();
    triggerUpdate();
};

// 타입 선택 버튼 이벤트
document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// 현재 나이 수정 시 목돈 나이도 동기화
inputs.currentAge.addEventListener('input', () => {
    const ageInput = document.getElementById('expAge');
    if (ageInput) {
        ageInput.min = inputs.currentAge.value;
        if (parseInt(ageInput.value) < parseInt(inputs.currentAge.value)) {
            ageInput.value = inputs.currentAge.value;
        }
    }
});

document.getElementById('btnAddExp').addEventListener('click', () => {
    const nameInput = document.getElementById('expName');
    const ageInput = document.getElementById('expAge');
    const amountInput = document.getElementById('expAmount');
    const activeBtn = document.querySelector('.type-btn.active');

    const name = nameInput.value || (activeBtn.dataset.type === 'income' ? '기타 수입' : '기타 지출');
    const age = parseInt(ageInput.value);
    const amountRaw = parseFormattedValue(amountInput.value) * 1000;
    const currentAge = parseInt(inputs.currentAge.value) || 0;

    if (!age || age < currentAge) {
        alert(`나이는 현재 나이(${currentAge}세)보다 크거나 같아야 합니다.`);
        return;
    }

    if (amountRaw > 0) {
        const amount = activeBtn.dataset.type === 'income' ? amountRaw : -amountRaw;
        futureExpenses.push({ name, amount, age });
        updateExpensesUI();
        triggerUpdate();

        nameInput.value = '';
        amountInput.value = '';

        const btn = document.getElementById('btnAddExp');
        const originalText = btn.textContent;
        btn.textContent = '추가됨';
        btn.style.background = '#22c55e';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '#6366f1';
        }, 1000);
    }
});

// 금액 자동 콤마 포맷팅
document.querySelectorAll('.monetary-input').forEach(input => {
    input.addEventListener('input', (e) => {
        const start = e.target.selectionStart;
        const oldLen = e.target.value.length;
        e.target.value = formatWithCommas(e.target.value);
        const newStart = start + (e.target.value.length - oldLen);
        if (e.target.type === 'text') e.target.setSelectionRange(newStart, newStart);
        triggerUpdate();
    });
});

function updateTooltip(sliderId, tooltipId, isReverse = false) {
    const slider = document.getElementById(sliderId);
    const tooltip = document.getElementById(tooltipId);
    if (!slider || !tooltip) return;

    let val = parseFloat(slider.value);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);

    if (isReverse) val = 100 - val;

    // 소수점 처리
    const formattedVal = (val % 1 === 0) ? val : val.toFixed(1);
    tooltip.textContent = `${formattedVal}%`;

    const percent = (parseFloat(slider.value) - min) / (max - min) * 100;

    // 트랙 배경 업데이트 (진행된 부분 색상 적용)
    slider.style.background = `linear-gradient(to right, var(--primary) ${percent}%, #f1f5f9 ${percent}%)`;

    // 수치 입력창 업데이트 (동기화) - 현재 포커스되지 않은 경우에만 업데이트하여 입력 방해 방지
    const inputId = sliderId.replace('slider', 'input');
    const numericInput = document.getElementById(inputId);
    if (numericInput && document.activeElement !== numericInput) {
        numericInput.value = isReverse ? (100 - parseFloat(slider.value)) : formattedVal;
    }

    // 20px thumb 기준 보정: center of thumb moves from 10px to (width-10px)
    tooltip.style.left = `calc(${percent}% + (${10 - percent * 0.2}px))`;
}

// 슬라이더 이벤트 설정
const sliderConfigs = [
    { id: 'sliderExpectedReturn', tooltip: 'tooltipExpectedReturn' },
    { id: 'sliderInflationRate', tooltip: 'tooltipInflationRate' },
    { id: 'sliderDepletionRate', tooltip: 'tooltipDepletionRate', isReverse: true }
];

sliderConfigs.forEach(cfg => {
    const slider = document.getElementById(cfg.id);
    const numericInput = document.getElementById(cfg.id.replace('slider', 'input'));

    if (slider) {
        slider.addEventListener('input', () => {
            updateTooltip(cfg.id, cfg.tooltip, cfg.isReverse);
            if (cfg.id === 'sliderDepletionRate') syncRadiosFromSlider(slider.value);
            triggerUpdate();
        });
    }

    if (numericInput) {
        numericInput.addEventListener('input', () => {
            let val = parseFloat(numericInput.value) || 0;
            // 범위 제한
            val = Math.max(parseFloat(numericInput.min), Math.min(parseFloat(numericInput.max), val));

            if (cfg.isReverse) {
                slider.value = 100 - val;
            } else {
                slider.value = val;
            }

            updateTooltip(cfg.id, cfg.tooltip, cfg.isReverse);
            if (cfg.id === 'sliderDepletionRate') syncRadiosFromSlider(slider.value);
            triggerUpdate();
        });
    }
});

// 슬라이더 <-> 입력창 동기화 설정 (기존 호환성 유지용 - 필요시 제거)
// 이제 sliders 자체가 inputs의 역할을 겸함

// 라디오 버튼(전략 선택) 동기화
function syncRadiosFromSlider(value) {
    const logicalValue = 100 - parseInt(value);
    let model = 'partial';
    if (logicalValue === 100) model = 'preservation';
    else if (logicalValue === 0) model = 'depletion';

    const radio = document.querySelector(`input[name="retireModel"][value="${model}"]`);
    if (radio) radio.checked = true;

    updateTooltip('sliderDepletionRate', 'tooltipDepletionRate', true);
}

// 데이터 보존 및 복구
function saveState() {
    const state = {
        inputs: {},
        futureExpenses: futureExpenses,
        retireModel: document.querySelector('input[name="retireModel"]:checked')?.value || 'preservation'
    };
    Object.keys(inputs).forEach(key => state.inputs[key] = inputs[key].value);
    localStorage.setItem('fire_calc_state_korean_v5', JSON.stringify(state));
}

function loadState() {
    const saved = JSON.parse(localStorage.getItem('fire_calc_state_korean_v5') || '{}');
    if (saved.inputs) {
        Object.keys(inputs).forEach(key => {
            if (saved.inputs[key] && inputs[key]) {
                inputs[key].value = saved.inputs[key];
                if (sliders[key]) sliders[key].value = saved.inputs[key];
            }
        });
    }
    if (saved.retireModel) {
        const radio = document.querySelector(`input[name="retireModel"][value="${saved.retireModel}"]`);
        if (radio) radio.checked = true;
    }
    if (saved.futureExpenses) {
        futureExpenses = saved.futureExpenses;
        updateExpensesUI();
    }
}

// 프리셋 데이터 정의
const presetData = {
    conservative: {
        income: "60,000",
        contribution: "750",
        expenses: "3,000",
        return: 6.0
    },
    moderate: {
        income: "72,000",
        contribution: "1,500",
        expenses: "4,000",
        return: 7.0
    },
    aggressive: {
        income: "84,000",
        contribution: "3,500",
        expenses: "5,000",
        return: 7.0
    }
};

// 프리셋 클릭 이벤트 리스너 추가
document.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', () => {
        const type = card.dataset.type;
        const data = presetData[type];

        if (data) {
            inputs.annualIncome.value = data.income;
            inputs.annualContribution.value = data.contribution;
            inputs.annualExpenses.value = data.expenses;

            inputs.expectedReturn.value = data.return.toFixed(1);
            if (sliders.expectedReturn) sliders.expectedReturn.value = data.return;

            triggerUpdate();

            // 시각적 효과
            document.querySelectorAll('.preset-card').forEach(c => {
                c.style.borderColor = 'var(--border)';
                c.style.background = 'var(--bg-card)';
            });
            card.style.borderColor = 'var(--primary)';
            card.style.background = '#f0f9ff';
        }
    });
});

// 기타 일반 입력 변경 감지
Object.values(inputs).forEach(el => {
    if (el && !el.classList.contains('monetary-input')) {
        el.addEventListener('input', triggerUpdate);
    }
});

document.querySelectorAll('input[name="retireModel"]').forEach(radio => {
    radio.addEventListener('change', updateUIState);
});

document.getElementById('btnReset').addEventListener('click', () => {
    if (confirm('모든 입력값이 초기화됩니다. 계속하시겠습니까?')) {
        localStorage.removeItem('fire_calc_state_korean_v5');
        window.location.reload();
    }
});

document.getElementById('btnCopy').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const btn = document.getElementById('btnCopy');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check"></i> 복사 완료';
        lucide.createIcons();
        setTimeout(() => {
            btn.innerHTML = originalText;
            lucide.createIcons();
        }, 2000);
    });
});

document.getElementById('btnExport').addEventListener('click', () => {
    const headers = ["항목", "값"];
    const rows = [
        ["현재 나이", inputs.currentAge.value],
        ["목표 은퇴 나이", inputs.targetAge.value],
        ["현재 자산", inputs.currentSavings.value],
        ["연간 소득", inputs.annualIncome.value],
        ["연간 추가 저축", inputs.annualContribution.value],
        ["은퇴 후 생활비", inputs.annualExpenses.value],
        ["기대 수익률", inputs.expectedReturn.value + "%"],
        ["물가 상승률", inputs.inflationRate.value + "%"],
        ["은퇴 목표 금액", displays.fireNumber.textContent]
    ];

    let csvContent = "\ufeff" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "FIRE_Retirement_Plan.csv");
    link.click();
});


// 초기 실행
loadState();

// 목돈 지출 나이 초기값 설정
if (document.getElementById('expAge')) {
    document.getElementById('expAge').value = inputs.currentAge.value;
}

calculateFIRE();
sliderConfigs.forEach(cfg => updateTooltip(cfg.id, cfg.tooltip, cfg.isReverse));
