/**
 * FIRE Calculator - Optimized version
 * Concerns are separated into State, Utils, Logic, UI, and Events.
 */

// --- 1. State & Configuration ---
const CONFIG = {
    storageKey: 'fire_calc_state_korean_v5',
    debounceTime: 1000
};

let state = {
    futureExpenses: [],
    retireModel: 'preservation'
};

const UI = {
    inputs: {
        birthDate: document.getElementById('birthDate'),
        retirementDate: document.getElementById('retirementDate'),
        lifeExpectancy: document.getElementById('lifeExpectancy'),
        currentSavings: document.getElementById('currentSavings'),
        annualContribution: document.getElementById('annualContribution'),
        annualIncome: document.getElementById('annualIncome'),
        annualExpenses: document.getElementById('annualExpenses'),
        monthlyPension: document.getElementById('monthlyPension'),
        pensionStartDate: document.getElementById('pensionStartDate'),
        expectedReturn: document.getElementById('sliderExpectedReturn'),
        inflationRate: document.getElementById('sliderInflationRate')
    },
    sliders: {
        expectedReturn: document.getElementById('sliderExpectedReturn'),
        inflationRate: document.getElementById('sliderInflationRate'),
        depletionRate: document.getElementById('sliderDepletionRate')
    },
    displays: {
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
    },
    chart: null
};

// --- 2. Utils ---
const Utils = {
    debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    parseNum(str) {
        if (!str) return 0;
        return parseFloat(str.toString().replace(/,/g, '')) || 0;
    },

    formatCommas(val) {
        if (val === undefined || val === null) return '';
        const num = val.toString().replace(/[^0-9]/g, '');
        return num === '' ? '' : Number(num).toLocaleString('ko-KR');
    },

    formatKoreanCurrency(value) {
        const absValue = Math.abs(value);
        if (absValue === 0) return '0원';

        if (absValue >= 100000000) {
            const eok = Math.floor(absValue / 100000000);
            const man = Math.floor((absValue % 100000000) / 10000);
            return man > 0 ? `${eok.toLocaleString()}억 ${man.toLocaleString()}만원` : `${eok.toLocaleString()}억원`;
        } else if (absValue >= 10000) {
            const man = Math.floor(absValue / 10000);
            return `${man.toLocaleString()}만원`;
        }
        return `${Math.floor(absValue).toLocaleString()}원`;
    },

    formatCompact(value) {
        if (value >= 100000000) return (value / 100000000).toFixed(1) + '억';
        if (value >= 10000) return (value / 10000).toFixed(0) + '만';
        return value.toLocaleString();
    },

    calculatePV(rate, nper, pmt, fv = 0) {
        if (nper <= 0) return fv;
        if (Math.abs(rate) < 0.0001) return pmt * nper + fv;
        const pvFactor = (1 - Math.pow(1 + rate, -nper)) / rate;
        const fvFactor = 1 / Math.pow(1 + rate, nper);
        return (pmt * pvFactor) + (fv * fvFactor);
    },

    parseYearMonthToAge(val, currentAge) {
        if (!val || !/^\d{4}-\d{2}$/.test(val)) return null;
        const [startYear, startMonth] = val.split('-').map(Number);
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const monthDiff = (startYear - currentYear) * 12 + (startMonth - currentMonth);
        return currentAge + (monthDiff / 12);
    },

    dateDiffInYears(birthDateStr, targetDateStr) {
        if (!birthDateStr || !targetDateStr || !/^\d{4}-\d{2}$/.test(birthDateStr) || !/^\d{4}-\d{2}$/.test(targetDateStr)) return null;
        const [y1, m1] = birthDateStr.split('-').map(Number);
        const [y2, m2] = targetDateStr.split('-').map(Number);
        return (y2 - y1) + (m2 - m1) / 12;
    },

    getCurrentAge(birthDateStr) {
        if (!birthDateStr || !/^\d{4}-\d{2}$/.test(birthDateStr)) return 0;
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return this.dateDiffInYears(birthDateStr, todayStr);
    }
};

// --- 3. UI Modules ---
const Renderer = {
    updateResultIndicators(fireAge, targetAge, currentAge, fireNumber, finalBalanceAdjusted, currentSavings) {
        const d = UI.displays;
        if (fireAge !== null) {
            const yearsToFire = fireAge - currentAge;
            d.yearsToFire.textContent = yearsToFire + '년';
            d.ageAtFire.textContent = `${fireAge}세에 목표 달성 예상`;
            d.yearsToGo.textContent = `목표 은퇴일(${targetAge}세)까지 넉넉합니다`;
            d.statusMessage.textContent = '현재 계획대로면 조기 은퇴도 가능해 보입니다!';
        } else {
            if (currentSavings >= fireNumber) {
                d.yearsToFire.textContent = '0년';
                d.ageAtFire.textContent = '목표 달성 완료';
                d.yearsToGo.textContent = '이미 충분한 자산을 확보하셨습니다';
                d.statusMessage.textContent = '축하합니다! 경제적 자유를 이루셨습니다.';
            } else {
                d.yearsToFire.textContent = '목표 미달성';
                d.ageAtFire.textContent = `${targetAge}세 시점에 부족 예상`;
                d.yearsToGo.textContent = '저축액을 높이거나 목표를 조정해 보세요';
                d.statusMessage.textContent = '목표 달성을 위해 조금 더 분발이 필요합니다.';
            }
        }

        const progress = fireNumber > 0 ? Math.min((currentSavings / fireNumber) * 100, 100) : 0;
        d.percProgress.textContent = progress.toFixed(1) + '%';
        d.progressBar.style.width = progress + '%';
    },

    updateDiagnosisText(rate, lifeExpectancy, targetAge, pensionStartAge, monthlyGap, fireNumber, currentSavings, suggestion = null) {
        let modelName = "";
        const currentRate = rate * 100;

        if (currentRate === 100) modelName = "원금 보존 모델";
        else if (currentRate === 0) modelName = "원금 완전 고갈 모델";
        else modelName = `원금 일부 고갈 모델 (${currentRate}% 유지)`;

        const progress = fireNumber > 0 ? (currentSavings / fireNumber) * 100 : 0;
        const bridgePeriod = Math.max(0, pensionStartAge - targetAge);
        const bridgeText = bridgePeriod > 0
            ? `<p>은퇴 후 약 <strong>${bridgePeriod.toFixed(1)}년</strong> 동안은 연금 없이 생활비 전액을 자산에서 충당해야 합니다.</p>`
            : "";

        let html = `
            <p>선택하신 전략은 <strong>'${modelName}'</strong>입니다.</p>
            ${bridgeText}
            <p>은퇴 후 월 부족분(${Utils.formatKoreanCurrency(monthlyGap)})을 충당하며 <strong>${lifeExpectancy.toFixed(1)}세</strong>까지 자산 가치를 유지하기 위해 
            은퇴 시점(<strong>${targetAge.toFixed(1)}세</strong>)에 총 <strong>${Utils.formatKoreanCurrency(Math.max(0, fireNumber))}</strong>이 필요합니다.</p>
            <p>현재의 저축 페이스를 유지할 경우, 목표 자산의 <strong>${progress.toFixed(1)}%</strong>를 이미 확보하신 상태입니다.</p>
        `;

        if (suggestion) {
            html += `
                <div class="suggestion-box" style="margin-top: 1.5rem; padding: 1.25rem; background: #fff7ed; border: 1px solid #ffedd5; border-radius: 1rem;">
                    <h4 style="color: #c2410c; margin-bottom: 0.75rem; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="sparkles" size="18"></i> 목표 달성을 위한 제안
                    </h4>
                    <ul style="list-style: none; padding: 0.5rem 0; margin: 0; display: flex; flex-direction: column; gap: 0.625rem;">
            `;

            if (suggestion.extraMonthly) {
                const extraAnnual = suggestion.extraMonthly * 12;
                html += `
                    <li style="color: #7c2d12; font-size: 0.95rem; line-height: 1.5;">
                        💡 <strong>방법 A: 매달 ${Utils.formatKoreanCurrency(suggestion.extraMonthly)}(연간 ${Utils.formatKoreanCurrency(extraAnnual)})</strong>를 더 저축하면 계획대로 <strong>${targetAge.toFixed(1)}세</strong>에 은퇴가 가능합니다.
                    </li>
                `;
            }

            if (suggestion.extraReturn && suggestion.extraReturn < 20) {
                html += `
                    <li style="color: #7c2d12; font-size: 0.95rem; line-height: 1.5;">
                        💡 <strong>방법 B:</strong> 연평균 수익률을 <strong>${suggestion.extraReturn.toFixed(1)}%p</strong> 더 높일 수 있는 투자 포트폴리오를 고려해 보세요.
                    </li>
                `;
            }

            if (suggestion.achievableAge) {
                const delayYears = suggestion.achievableAge - targetAge;
                const style = delayYears > 10 ? "color: #b91c1c; font-weight: 700;" : "";
                html += `
                    <li style="color: #7c2d12; font-size: 0.95rem; line-height: 1.5; border-top: 1px dashed #fed7aa; padding-top: 0.75rem; margin-top: 0.5rem;">
                        ⚠️ <strong>차선책:</strong> 은퇴 시점을 <strong>${suggestion.achievableAge.toFixed(1)}세</strong>로 조정하세요. <span style="${style}">(은퇴 ${delayYears.toFixed(1)}년 연기)</span>
                    </li>
                `;
            } else if (suggestion.neverReached && !suggestion.extraMonthly && !suggestion.extraReturn) {
                html += `
                    <li style="color: #7c2d12; font-size: 0.95rem; line-height: 1.5; border-top: 1px dashed #fed7aa; padding-top: 0.75rem; margin-top: 0.5rem;">
                        💡 <strong>조언:</strong> 현재 설정으로는 현실적인 대안을 계산하기 어렵습니다. 목표 금액을 낮추거나 은퇴 나이를 조정해 보세요.
                    </li>
                `;
            }

            html += `
                    </ul>
                </div>
            `;
            setTimeout(() => lucide.createIcons(), 0);
        }

        UI.displays.understandingText.innerHTML = html;
    },

    updateChart(labels, balances, balancesAdjusted, target, fireAge, targetAge) {
        const ctx = document.getElementById('fireChart').getContext('2d');
        if (UI.chart) UI.chart.destroy();

        const gradientNominal = ctx.createLinearGradient(0, 0, 0, 400);
        gradientNominal.addColorStop(0, 'rgba(14, 165, 233, 0.2)');
        gradientNominal.addColorStop(1, 'rgba(14, 165, 233, 0)');

        const gradientReal = ctx.createLinearGradient(0, 0, 0, 400);
        gradientReal.addColorStop(0, 'rgba(2, 132, 199, 0.1)');
        gradientReal.addColorStop(1, 'rgba(2, 132, 199, 0)');

        const annotations = {
            workingPhase: {
                type: 'box', xMin: labels[0], xMax: targetAge, backgroundColor: 'rgba(34, 197, 94, 0.03)', borderWidth: 0,
                label: { display: true, content: '저축 및 자산 형성기', position: 'start', font: { size: 11, weight: 'bold', family: 'Noto Sans KR' }, color: 'rgba(34, 197, 94, 0.5)', yAdjust: 10 }
            },
            retirementPhase: {
                type: 'box', xMin: targetAge, xMax: labels[labels.length - 1], backgroundColor: 'rgba(249, 115, 22, 0.03)', borderWidth: 0,
                label: { display: true, content: '은퇴 및 자산 인출기', position: 'end', font: { size: 11, weight: 'bold', family: 'Noto Sans KR' }, color: 'rgba(249, 115, 22, 0.5)', yAdjust: 10 }
            },
            retirementLine: {
                type: 'line', xMin: targetAge, xMax: targetAge, borderColor: 'rgba(100, 116, 139, 0.3)', borderWidth: 1,
                label: { display: true, content: `${targetAge}세 은퇴`, position: 'end', backgroundColor: 'rgba(100, 116, 139, 0.8)', font: { size: 10 } }
            }
        };

        if (fireAge !== null) {
            annotations.fireMarker = {
                type: 'point', xValue: fireAge, yValue: balancesAdjusted[labels.indexOf(fireAge)],
                backgroundColor: '#ef4444', radius: 6, borderColor: '#fff', borderWidth: 2,
                label: { display: true, content: 'FIRE 달성!', backgroundColor: '#ef4444', color: '#fff', font: { weight: 'bold', size: 11 }, yAdjust: -20 }
            };
        }

        state.futureExpenses.forEach((exp, i) => {
            if (labels.includes(exp.age)) {
                annotations[`event_${i}`] = {
                    type: 'point', xValue: exp.age, yValue: balances[labels.indexOf(exp.age)],
                    backgroundColor: exp.amount > 0 ? '#22c55e' : '#ef4444', radius: 4
                };
            }
        });

        UI.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: '실질 가치 (구매력 기준)', data: balancesAdjusted, borderColor: '#0284c7', borderWidth: 3, backgroundColor: gradientReal, fill: true, tension: 0.4, pointRadius: 0, zIndex: 2 },
                    { label: '예상 자산 (명목 금액)', data: balances, borderColor: 'rgba(14, 165, 233, 0.4)', borderWidth: 2, backgroundColor: gradientNominal, borderDash: [5, 5], fill: true, tension: 0.4, pointRadius: 0, zIndex: 1 },
                    { label: '은퇴 목표선', data: labels.map(() => target), borderColor: 'rgba(239, 68, 68, 0.5)', borderWidth: 2, borderDash: [2, 2], pointRadius: 0, fill: false, zIndex: 0 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'bottom', labels: { font: { family: 'Noto Sans KR', size: 12 }, usePointStyle: true, padding: 20 } },
                    tooltip: {
                        padding: 12, backgroundColor: 'rgba(255, 255, 255, 0.95)', titleColor: '#1e293b', bodyColor: '#475569',
                        borderColor: '#e2e8f0', borderWidth: 1, titleFont: { weight: 'bold', size: 14, family: 'Noto Sans KR' },
                        bodyFont: { family: 'Noto Sans KR' },
                        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${Utils.formatKoreanCurrency(ctx.raw)}` }
                    },
                    annotation: { annotations: annotations }
                },
                scales: {
                    y: {
                        grid: { color: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
                        ticks: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b',
                            callback: (val) => Utils.formatCompact(val),
                            font: { size: 11 }
                        }
                    },
                    x: {
                        grid: { display: false },
                        title: {
                            display: true,
                            text: '나이 (세)',
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b',
                            font: { family: 'Noto Sans KR', weight: 'bold' }
                        },
                        ticks: {
                            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#94a3b8' : '#64748b',
                            maxRotation: 0, autoSkip: true, maxTicksLimit: 10
                        }
                    }
                }
            }
        });
    }
};

// --- 4. Logic ---
const Logic = {
    calculateFIRE() {
        const u = UI.inputs;
        const birthDateStr = u.birthDate.value;
        const retirementDateStr = u.retirementDate.value;
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const currentAge = Utils.getCurrentAge(birthDateStr) || 50;
        const targetAge = Utils.dateDiffInYears(birthDateStr, retirementDateStr) || 62;
        const lifeExpectancy = Math.max(targetAge, parseInt(u.lifeExpectancy.value) || 95);
        const currentSavings = Utils.parseNum(u.currentSavings.value) * 10000;

        const monthlyIncome = (Utils.parseNum(u.annualIncome.value) * 10000) / 12;
        const monthlyContribution = (Utils.parseNum(u.annualContribution.value) * 10000) / 12;
        const monthlyExpenses = Utils.parseNum(u.annualExpenses.value) * 10000;
        const monthlyPension = Utils.parseNum(u.monthlyPension.value) * 10000;

        const nominalReturn = (parseFloat(u.expectedReturn.value) || 0) / 100;
        const inflation = (parseFloat(u.inflationRate.value) || 0) / 100;
        const realReturn = nominalReturn - inflation;
        const preservationRate = (100 - (parseInt(UI.sliders.depletionRate.value) || 0)) / 100;

        // 연금 개시 시점 계산 및 폴백 로직
        const startVal = u.pensionStartDate.value;
        let pensionStartAge = Utils.dateDiffInYears(birthDateStr, startVal);

        // 날짜 형식이 잘못되었거나 비어있다면 은퇴 나이를 기본값으로 사용
        if (pensionStartAge === null) {
            pensionStartAge = targetAge;
        }

        // 은퇴 기간 시뮬레이션 및 필요 자산(fireNumber) 역산
        // 1단계: 연금 개시 전 (생활비 전액 필요)
        // 2단계: 연금 개시 후 (생활비 - 연금 필요)

        const monthlyGapWithPension = Math.max(0, monthlyExpenses - monthlyPension);
        const monthlyGapNoPension = monthlyExpenses;

        const yearsToPension = Math.max(0, pensionStartAge - targetAge);
        const actualPensionStart = Math.max(targetAge, pensionStartAge);
        const yearsAfterPension = Math.max(0, lifeExpectancy - actualPensionStart);

        // 연금 개시 후 시점의 목표액 (Pv_at_pension_start)
        const preservationTarget = realReturn > 0 ? (monthlyGapWithPension * 12) / realReturn : (monthlyGapWithPension * 12) * 25;
        const finalBalanceAtEnd = preservationTarget * preservationRate;

        const targetAtPensionStart = Utils.calculatePV(realReturn, yearsAfterPension, monthlyGapWithPension * 12, finalBalanceAtEnd);

        // 은퇴 시점의 목표액 (fireNumber)
        let fireNumber = Utils.calculatePV(realReturn, yearsToPension, monthlyGapNoPension * 12, targetAtPensionStart);

        state.futureExpenses.forEach(exp => {
            fireNumber -= exp.amount * Math.pow(1 + realReturn, targetAge - exp.age);
        });

        UI.displays.fireNumber.textContent = Utils.formatKoreanCurrency(Math.max(0, fireNumber));
        UI.displays.progressTarget.textContent = Utils.formatKoreanCurrency(Math.max(0, fireNumber));
        UI.displays.progressCurrent.textContent = Utils.formatKoreanCurrency(currentSavings);

        const savingsRate = monthlyIncome > 0 ? (monthlyContribution / monthlyIncome) * 100 : 0;
        UI.displays.savingsRate.textContent = savingsRate.toFixed(1) + '%';
        UI.displays.contribPerMonth.textContent = `월 ${Utils.formatKoreanCurrency(monthlyContribution)} 저축 중`;

        const labels = [], balances = [], balancesAdjusted = [];
        let balance = currentSavings, balanceAdjusted = currentSavings, fireAge = null;
        const maxSimAge = Math.max(100, lifeExpectancy);

        for (let age = currentAge; age <= maxSimAge; age++) {
            labels.push(age);
            balances.push(Math.round(balance));
            balancesAdjusted.push(Math.round(balanceAdjusted));

            if (fireAge === null && balanceAdjusted >= fireNumber && age <= targetAge) fireAge = age;

            // 미래 목돈 반영 (해당 나이 연초에 반영)
            state.futureExpenses.forEach(exp => {
                if (exp.age === age) {
                    balance += exp.amount;
                    balanceAdjusted += exp.amount;
                }
            });

            // 월 단위 정밀 시뮬레이션 (12개월 루프)
            for (let m = 0; m < 12; m++) {
                const currentMonthAge = age + (m / 12);
                if (age < targetAge) {
                    // 자산 형성기: 월 복리 수익 + 월 저축액
                    balance = balance * (1 + nominalReturn / 12) + monthlyContribution;
                    balanceAdjusted = balanceAdjusted * (1 + realReturn / 12) + monthlyContribution;
                } else {
                    // 은퇴기: 연금 개시 여부에 따른 차등 적용
                    const isPensionStarted = currentMonthAge >= pensionStartAge;
                    const monthlyGap = isPensionStarted ? monthlyGapWithPension : monthlyGapNoPension;

                    balance = balance * (1 + nominalReturn / 12) - monthlyGap * Math.pow(1 + inflation / 12, (age - currentAge) * 12 + m);
                    // 실질 가치 계산 시에는 물가상승률을 제외한 realReturn 사용
                    balanceAdjusted = balanceAdjusted * (1 + realReturn / 12) - monthlyGap;
                }
            }

            // 음수 방지
            balance = Math.max(0, balance);
            balanceAdjusted = Math.max(0, balanceAdjusted);
        }

        Renderer.updateResultIndicators(fireAge, targetAge, currentAge, fireNumber, balanceAdjusted, currentSavings);

        let suggestion = null;
        if (fireAge === null || fireAge > targetAge) {
            const yearsLeft = targetAge - currentAge;
            if (yearsLeft > 0) {
                const r = realReturn / 12, n = yearsLeft * 12;
                const targetIdx = labels.indexOf(targetAge);
                const currentExpectedAtTarget = targetIdx !== -1 ? balancesAdjusted[targetIdx] : 0;
                const shortFall = Math.max(0, fireNumber - currentExpectedAtTarget);
                if (shortFall > 0 && r > 0) {
                    suggestion = { extraMonthly: shortFall * (r / (Math.pow(1 + r, n) - 1)) };
                }
            }
            let found = false;
            for (let i = 0; i < balancesAdjusted.length; i++) {
                if (balancesAdjusted[i] >= fireNumber) {
                    if (!suggestion) suggestion = {};
                    suggestion.achievableAge = labels[i];
                    found = true; break;
                }
            }
            if (!found) { if (!suggestion) suggestion = {}; suggestion.neverReached = true; }
            if (yearsLeft > 0) {
                const targetIdx = labels.indexOf(targetAge);
                const currentExpectedAtTarget = targetIdx !== -1 ? balancesAdjusted[targetIdx] : 0;
                if (currentExpectedAtTarget > 0 && currentExpectedAtTarget < fireNumber) {
                    if (!suggestion) suggestion = {};
                    suggestion.extraReturn = (Math.pow(fireNumber / currentExpectedAtTarget, 1 / yearsLeft) - 1) * 100;
                }
            }
        }

        Renderer.updateDiagnosisText(preservationRate, lifeExpectancy, targetAge, pensionStartAge, monthlyGapWithPension, fireNumber, currentSavings, suggestion);
        Renderer.updateChart(labels, balances, balancesAdjusted, fireNumber, fireAge, targetAge);
    }
};

// --- 5. Application Core ---
const App = {
    init() {
        this.loadState();
        this.initTheme(); // 테마 초기화 추가
        this.initDates(); // 날짜 초기값 설정
        this.bindEvents();
        Logic.calculateFIRE();
        this.updateTooltips();
    },

    bindEvents() {
        const trigger = () => this.triggerUpdate();

        // Inputs
        Object.values(UI.inputs).forEach(el => {
            if (el) {
                el.addEventListener('input', (e) => {
                    // 은퇴년월이 변경될 때 연금 개시일이 아직 한번도 수정되지 않았다면 동기화
                    if (el.id === 'retirementDate' && !state.pensionDateTouched) {
                        this.initPensionDate(true);
                    }
                    trigger();
                });
            }
        });

        // Sliders
        const sliderConfigs = [
            { id: 'sliderExpectedReturn', tooltip: 'tooltipExpectedReturn' },
            { id: 'sliderInflationRate', tooltip: 'tooltipInflationRate' },
            { id: 'sliderDepletionRate', tooltip: 'tooltipDepletionRate', isReverse: true }
        ];
        sliderConfigs.forEach(cfg => {
            const slider = document.getElementById(cfg.id);
            const numInput = document.getElementById(cfg.id.replace('slider', 'input'));

            if (slider) slider.addEventListener('input', () => {
                this.updateSliderTooltip(cfg.id, cfg.tooltip, cfg.isReverse);
                if (cfg.id === 'sliderDepletionRate') this.syncRadiosFromSlider(slider.value);
                trigger();
            });
            if (numInput) numInput.addEventListener('input', () => {
                let val = Math.max(parseFloat(numInput.min), Math.min(parseFloat(numInput.max), parseFloat(numInput.value) || 0));
                slider.value = cfg.isReverse ? 100 - val : val;
                this.updateSliderTooltip(cfg.id, cfg.tooltip, cfg.isReverse);
                trigger();
            });
        });

        // Strategy Radios
        document.querySelectorAll('input[name="retireModel"]').forEach(r => {
            r.addEventListener('change', (e) => this.handleStrategyChange(e));
        });

        // Monetary Inputs
        document.querySelectorAll('.monetary-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const start = e.target.selectionStart;
                const oldLen = e.target.value.length;
                e.target.value = Utils.formatCommas(e.target.value);
                const newStart = start + (e.target.value.length - oldLen);
                if (e.target.type === 'text') e.target.setSelectionRange(newStart, newStart);
            });
        });

        // Presets
        document.querySelectorAll('.preset-card').forEach(card => {
            card.addEventListener('click', () => this.applyPreset(card));
        });

        // Future Expenses
        document.getElementById('btnAddExp').addEventListener('click', () => this.addFutureExpense());
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        document.getElementById('btnReset').addEventListener('click', () => this.reset());
        document.getElementById('btnExport').addEventListener('click', () => this.exportToCSV());
        document.getElementById('btnCopy').addEventListener('click', () => this.copyURL());

        // 테마 토글 버튼 이벤트
        document.getElementById('btnTheme').addEventListener('click', () => this.toggleTheme());

        // 연금 및 생년월일, 은퇴일 입력 포맷 자동 완성 (YYYY-MM)
        [UI.inputs.pensionStartDate, UI.inputs.birthDate, UI.inputs.retirementDate].forEach(input => {
            if (!input) return;
            input.addEventListener('input', (e) => {
                if (input.id === 'pensionStartDate') state.pensionDateTouched = true;
                let val = e.target.value.replace(/[^0-9]/g, '');
                if (val.length > 4) {
                    val = val.substring(0, 4) + '-' + val.substring(4, 6);
                }
                e.target.value = val.substring(0, 7);
            });
        });
    },

    triggerUpdate: Utils.debounce(() => {
        Logic.calculateFIRE();
        App.saveState();
    }, 100),

    updateSliderTooltip(sliderId, tooltipId, isReverse = false) {
        const slider = document.getElementById(sliderId);
        const tooltip = document.getElementById(tooltipId);
        if (!slider || !tooltip) return;

        let val = parseFloat(slider.value);
        const percent = (val - slider.min) / (slider.max - slider.min) * 100;
        if (isReverse) val = 100 - val;

        tooltip.textContent = `${(val % 1 === 0) ? val : val.toFixed(1)}%`;
        slider.style.background = `linear-gradient(to right, var(--primary) ${percent}%, #f1f5f9 ${percent}%)`;
        tooltip.style.left = `calc(${percent}% + (${10 - percent * 0.2}px))`;

        const numInput = document.getElementById(sliderId.replace('slider', 'input'));
        if (numInput && document.activeElement !== numInput) {
            numInput.value = (val % 1 === 0) ? val : val.toFixed(1);
        }
    },

    updateTooltips() {
        const configs = [
            { id: 'sliderExpectedReturn', tooltip: 'tooltipExpectedReturn' },
            { id: 'sliderInflationRate', tooltip: 'tooltipInflationRate' },
            { id: 'sliderDepletionRate', tooltip: 'tooltipDepletionRate', isReverse: true }
        ];
        configs.forEach(c => this.updateSliderTooltip(c.id, c.tooltip, c.isReverse));
    },

    handleStrategyChange(e) {
        const selected = document.querySelector('input[name="retireModel"]:checked').value;
        const presets = { 'preservation': 100, 'depletion': 0, 'partial': 50 };
        if (presets[selected] !== undefined) {
            UI.sliders.depletionRate.value = 100 - presets[selected];
            this.updateSliderTooltip('sliderDepletionRate', 'tooltipDepletionRate', true);
        }
        this.triggerUpdate();
    },

    syncRadiosFromSlider(value) {
        const logical = 100 - parseInt(value);
        let model = logical === 100 ? 'preservation' : (logical === 0 ? 'depletion' : 'partial');
        const radio = document.querySelector(`input[name="retireModel"][value="${model}"]`);
        if (radio) radio.checked = true;
    },

    applyPreset(card) {
        const data = {
            conservative: { income: "600", contribution: "75", expenses: "300", return: 6.0 },
            moderate: { income: "720", contribution: "150", expenses: "400", return: 7.0 },
            aggressive: { income: "840", contribution: "350", expenses: "500", return: 7.0 }
        }[card.dataset.type];

        if (data) {
            UI.inputs.annualIncome.value = data.income;
            UI.inputs.annualContribution.value = data.contribution;
            UI.inputs.annualExpenses.value = data.expenses;
            UI.inputs.expectedReturn.value = data.return.toFixed(1);
            UI.sliders.expectedReturn.value = data.return;
            this.triggerUpdate();
            this.updateTooltips();
            document.querySelectorAll('.preset-card').forEach(c => {
                c.style.borderColor = 'var(--border)';
                c.style.background = 'var(--bg-card)';
            });
            card.style.borderColor = 'var(--primary)';
            card.style.background = '#f0f9ff';
        }
    },

    addFutureExpense() {
        const nameIn = document.getElementById('expName'), ageIn = document.getElementById('expAge'), amtIn = document.getElementById('expAmount');
        const type = document.querySelector('.type-btn.active').dataset.type;
        const name = nameIn.value || (type === 'income' ? '기타 수입' : '기타 지출');
        const age = parseInt(ageIn.value), amt = Utils.parseNum(amtIn.value) * 10000;

        if (!age || age < parseInt(UI.inputs.currentAge.value)) return alert('나이 설정을 확인해주세요.');
        if (amt > 0) {
            state.futureExpenses.push({ name, amount: type === 'income' ? amt : -amt, age });
            this.updateExpensesUI();
            this.triggerUpdate();
            nameIn.value = ''; amtIn.value = '';
        }
    },

    updateExpensesUI() {
        const list = document.getElementById('futureExpensesList');
        list.innerHTML = '';
        state.futureExpenses.forEach((exp, i) => {
            const isInc = exp.amount > 0;
            const item = document.createElement('div');
            item.className = 'expense-item';
            item.style = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.85rem; padding: 6px 10px; background: ${isInc ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isInc ? '#dcfce7' : '#fee2e2'}; border-radius: 6px;`;
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="${isInc ? 'trending-up' : 'trending-down'}" size="14" style="color: ${isInc ? '#16a34a' : '#dc2626'}"></i>
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 600; color: #334155;">${exp.name} (${exp.age}세)</span>
                        <span style="color: ${isInc ? '#16a34a' : '#dc2626'}; font-size: 0.8rem; font-weight: 500;">${isInc ? '+' : ''}${Utils.formatKoreanCurrency(exp.amount)}</span>
                    </div>
                </div>
                <button onclick="App.removeExpense(${i})" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px;"><i data-lucide="x" size="14"></i></button>
            `;
            list.appendChild(item);
        });
        if (window.lucide) window.lucide.createIcons();
    },

    removeExpense(i) { state.futureExpenses.splice(i, 1); this.updateExpensesUI(); this.triggerUpdate(); },

    saveState() {
        try {
            const data = { inputs: {}, futureExpenses: state.futureExpenses, retireModel: document.querySelector('input[name="retireModel"]:checked')?.value || 'preservation' };
            Object.keys(UI.inputs).forEach(k => data.inputs[k] = UI.inputs[k].value);
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save state to localStorage:', e);
        }
    },

    loadState() {
        try {
            const saved = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}');
            if (saved.inputs) Object.keys(UI.inputs).forEach(k => { if (saved.inputs[k]) UI.inputs[k].value = saved.inputs[k]; });
            if (saved.retireModel) {
                const r = document.querySelector(`input[name="retireModel"][value="${saved.retireModel}"]`);
                if (r) r.checked = true;
            }
            if (saved.futureExpenses) { state.futureExpenses = saved.futureExpenses; this.updateExpensesUI(); }
        } catch (e) {
            console.error('Failed to load state from localStorage:', e);
        }
    },

    initTheme() {
        const savedTheme = localStorage.getItem('fire_map_theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (systemDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('fire_map_theme', next);

        // 차트도 테마에 맞게 다시 그려야 효과적일 수 있음 (그리드 색상 등)
        Logic.calculateFIRE();
    },

    initPensionDate(force = false) {
        if (!UI.inputs.pensionStartDate.value || force) {
            UI.inputs.pensionStartDate.value = UI.inputs.retirementDate.value;
        }
    },

    initDates() {
        const saved = localStorage.getItem(CONFIG.storageKey);
        if (saved) return; // 저장된 값이 있으면 무시

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');

        // 기본값: 생년월(현재 - 50년), 은퇴년월(현재 + 12년)
        if (!UI.inputs.birthDate.value) UI.inputs.birthDate.value = `${yyyy - 50}-${mm}`;
        if (!UI.inputs.retirementDate.value) UI.inputs.retirementDate.value = `${yyyy + 12}-${mm}`;
        this.initPensionDate();
    },

    reset() { if (confirm('모든 입력값이 초기화됩니다.')) { localStorage.removeItem(CONFIG.storageKey); location.reload(); } },

    copyURL() {
        navigator.clipboard.writeText(location.href).then(() => {
            const b = document.getElementById('btnCopy'), old = b.innerHTML;
            b.innerHTML = '<i data-lucide="check"></i> 복사 완료';
            lucide.createIcons();
            setTimeout(() => { b.innerHTML = old; lucide.createIcons(); }, 2000);
        });
    },

    exportToCSV() {
        const rows = [
            ["항목", "내용"], ["--- 기본 정보 ---", ""],
            ["생년월", UI.inputs.birthDate.value],
            ["목표 은퇴년월", UI.inputs.retirementDate.value],
            ["현재 총 자산", UI.inputs.currentSavings.value + " (만원)"],
            ["연간 소득", UI.inputs.annualIncome.value + " (만원/년)"],
            ["연간 추가 저축액", UI.inputs.annualContribution.value + " (만원/년)"],
            ["은퇴 후 월 생활비", UI.inputs.annualExpenses.value + " (만원/월)"],
            ["은퇴 후 월 예상 연금", UI.inputs.monthlyPension.value + " (만원/월)"],
            ["연금 개시년월", UI.inputs.pensionStartDate.value],
            ["--- 경제 지표 ---", ""],
            ["기대 수익률", UI.inputs.expectedReturn.value + "%"],
            ["물가 상승률", UI.inputs.inflationRate.value + "%"],
            ["--- 결과 ---", ""],
            ["은퇴 목표 금액", UI.displays.fireNumber.textContent],
            ["은퇴 달성 시점", UI.displays.ageAtFire.textContent]
        ];
        if (state.futureExpenses.length > 0) {
            rows.push(["--- 미래 목돈 상세 ---", ""]);
            state.futureExpenses.forEach(e => rows.push([`${e.amount > 0 ? '[수입]' : '[지출]'} ${e.name}`, `${e.age}세 | ${Utils.formatKoreanCurrency(e.amount)}`]));
        }
        const csv = "\ufeff" + rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        link.download = `FIRE_계획서_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    }
};

// Global accessor for inline HTML calls
window.App = App;

// Initial start
document.addEventListener('DOMContentLoaded', () => App.init());
