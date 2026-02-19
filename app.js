/**
 * FIRE Calculator - Optimized version
 * Concerns are separated into State, Utils, Logic, UI, and Events.
 */

// --- 1. State & Configuration ---
const CONFIG = {
    storageKey: 'fire_calc_state_korean_v5',
    debounceTime: 150
};

let state = {
    futureExpenses: [],
    retireModel: 'preservation',
    lastResult: null
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
        const sign = value < 0 ? '-' : '';
        if (absValue === 0) return '0원';

        if (absValue >= 100000000) {
            const eok = Math.floor(absValue / 100000000);
            const man = Math.floor((absValue % 100000000) / 10000);
            return sign + (man > 0 ? `${eok.toLocaleString()}억 ${man.toLocaleString()}만원` : `${eok.toLocaleString()}억원`);
        } else if (absValue >= 10000) {
            const man = Math.floor(absValue / 10000);
            return sign + `${man.toLocaleString()}만원`;
        }
        return sign + `${Math.floor(absValue).toLocaleString()}원`;
    },

    formatCompact(value) {
        if (value >= 100000000) return (value / 100000000).toFixed(1) + '억';
        if (value >= 10000) return (value / 10000).toFixed(0) + '만';
        return value.toLocaleString();
    },

    calculatePV(realRate, years, monthlyPmt, fv = 0) {
        const n = Math.max(0, years * 12);
        const r = realRate / 12;
        if (n <= 0) return fv;
        if (Math.abs(r) < 0.000001) return (monthlyPmt * n) + fv;

        const pvFactor = (1 - Math.pow(1 + r, -n)) / r;
        const fvFactor = Math.pow(1 + r, -n);
        return (monthlyPmt * pvFactor) + (fv * fvFactor);
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
        const totalMonths = (y2 - y1) * 12 + (m2 - m1);
        return Math.max(0, totalMonths / 12); // 음수 나이 방지 핵심 로직
    },

    getCurrentAge(birthDateStr) {
        if (!birthDateStr || !/^\d{4}-\d{2}$/.test(birthDateStr)) return null;
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return this.dateDiffInYears(birthDateStr, todayStr);
    },

    formatAge(age) {
        if (typeof age !== 'number') return '0.0';
        return age.toFixed(1);
    },

    animateNumber(el, target, duration = 500, formatter = (v) => v) {
        const start = parseFloat(el.getAttribute('data-val')) || 0;
        const startTime = performance.now();

        const update = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = start + (target - start) * progress;
            el.textContent = formatter(current);
            el.setAttribute('data-val', current);
            if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }
};

// --- 3. UI Modules ---
const Renderer = {
    updateResultIndicators(fireAge, targetAge, currentAge, fireNumber, finalBalanceAdjusted, currentSavings) {
        const d = UI.displays;
        const alreadyAchieved = currentSavings >= fireNumber;
        const pastRetirement = currentAge >= targetAge;

        if (alreadyAchieved && pastRetirement) {
            // 이미 은퇴 시점을 지났고 자산도 충분한 경우
            d.yearsToFire.textContent = '달성 완료';
            d.ageAtFire.textContent = '은퇴 목표 이미 달성';
            d.yearsToGo.textContent = '이미 충분한 자산을 확보하셨습니다';
            d.statusMessage.textContent = '축하합니다! 경제적 자유를 이루셨습니다.';
        } else if (alreadyAchieved) {
            // 아직 은퇴 전이지만 자산이 이미 충분한 경우
            d.yearsToFire.textContent = '달성 완료';
            d.ageAtFire.textContent = '목표 달성 완료';
            d.yearsToGo.textContent = '이미 충분한 자산을 확보하셨습니다';
            d.statusMessage.textContent = '축하합니다! 경제적 자유를 이루셨습니다.';
        } else if (fireAge !== null && fireAge > currentAge) {
            // 미래에 목표 달성 가능한 경우
            const yearsToFire = fireAge - currentAge;
            d.yearsToFire.textContent = Utils.formatAge(yearsToFire) + '년';
            d.ageAtFire.textContent = `${Utils.formatAge(fireAge)}세에 목표 달성 예상`;
            d.yearsToGo.textContent = `목표 은퇴 시점(${Utils.formatAge(targetAge)}세)보다 빠른 달성이 가능합니다`;
            d.statusMessage.textContent = '현재 계획대로면 조기 은퇴도 가능해 보입니다!';
        } else {
            // 목표 미달성
            if (pastRetirement) {
                d.yearsToFire.textContent = '목표 미달성';
                d.ageAtFire.textContent = '현재 자산이 목표 금액에 미달합니다';
                d.yearsToGo.textContent = '추가 자금 마련이나 지출 조정을 검토해 보세요';
                d.statusMessage.textContent = '자산 보강 전략이 필요합니다.';
            } else {
                d.yearsToFire.textContent = '목표 미달성';
                d.ageAtFire.textContent = `${Utils.formatAge(targetAge)}세까지 목표 금액에 도달하기 어렵습니다`;
                d.yearsToGo.textContent = '저축액을 높이거나 목표를 조정해 보세요';
                d.statusMessage.textContent = '추가적인 전략 조정이 필요합니다.';
            }
        }

        const progress = fireNumber > 0 ? (currentSavings / fireNumber) * 100 : (currentSavings > 0 ? 100 : 0);
        Utils.animateNumber(d.percProgress, Math.min(progress, 999.9), 500, (v) => v.toFixed(1) + '%');
        d.progressBar.style.width = Math.min(progress, 100) + '%';

        // 프로그레스 바 색상 동적 변경
        if (progress >= 100) d.progressBar.style.background = 'var(--success)';
        else d.progressBar.style.background = 'var(--primary-gradient)';
    },

    updateDiagnosisText(rate, lifeExpectancy, targetAge, currentAge, pensionStartAge, monthlyGap, fireNumber, currentSavings, monthlyExpenses, monthlyPension, suggestion = null) {
        let modelName = "";
        const currentRate = rate * 100;

        if (currentRate === 100) modelName = "원금 보존 모델";
        else if (currentRate === 0) modelName = "원금 소진 모델";
        else modelName = `원금 일부 소진 모델 (${currentRate}% 유지)`;

        const progressNum = fireNumber > 0 ? (currentSavings / fireNumber) * 100 : (currentSavings >= 0 ? 100 : 0);
        const bridgePeriod = Math.max(0, pensionStartAge - targetAge);
        const bridgeText = bridgePeriod > 0
            ? `<p>은퇴 후 약 <strong>${Utils.formatAge(bridgePeriod)}년</strong> 동안은 연금 없이 생활비 전액을 자산에서 충당해야 합니다.</p>`
            : "";

        let diagnosisIntro = "";
        const isAlreadyRetired = targetAge <= currentAge;

        if (fireNumber <= 0) {
            diagnosisIntro = `
                <p>현재 설정하신 조건에 따르면, 은퇴 후 발생하는 수입(연금 등)이 지출보다 많거나 같아 별도의 은퇴 자금이 필요하지 않은 <strong>여유로운 상태</strong>입니다.</p>
                <p>별도로 확보해야 할 은퇴 자산은 없습니다.</p>
            `;
        } else if (currentSavings >= fireNumber) {
            diagnosisIntro = `
                <p>축하합니다! 현재 이미 ${isAlreadyRetired ? '현재 나이 기준 ' : ''}은퇴 목표 금액인 <strong>${Utils.formatKoreanCurrency(fireNumber)}</strong>을 초과 달성하셨습니다.</p>
                <p>현재의 자산만으로도 <strong>${Utils.formatAge(lifeExpectancy)}세</strong>까지 계획하신 라이프스타일을 충분히 유지하며 <strong>'${modelName}'</strong> 전략을 수행할 수 있는 <strong>매우 안정적인 상태</strong>입니다.</p>
            `;
        } else {
            const gapSumText = monthlyGap > 0
                ? `은퇴 후 매달 추가로 필요한 <strong>${Utils.formatKoreanCurrency(monthlyGap)}</strong>을 충당하며`
                : `연금 개시 후 수입이 충분하더라도, 연금 개시 전까지의 생활비 등을 고려할 때`;

            const maintenanceText = currentRate === 0
                ? `<strong>${Utils.formatAge(lifeExpectancy)}세</strong>에 자산이 소진되도록 설계했을 때`
                : `<strong>${Utils.formatAge(lifeExpectancy)}세</strong>까지 자산 가치를 유지하기 위해`;

            diagnosisIntro = `
                <p>${gapSumText} ${maintenanceText} 
                ${isAlreadyRetired ? '현재 시점' : '은퇴 시점(' + Utils.formatAge(targetAge) + '세)'}에 총 <strong>${Utils.formatKoreanCurrency(Math.max(0, fireNumber))}</strong>이 필요합니다.</p>
                <p>현재의 저축·투자 속도를 유지할 경우, 목표 자산의 <strong>${progressNum.toFixed(1)}%</strong>를 이미 확보하신 상태입니다.</p>
            `;
        }

        let html = `
            <p>선택하신 전략은 <strong>'${modelName}'</strong>입니다.</p>
            ${bridgeText}
            ${diagnosisIntro}
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
                            💡 <strong>방법 A: 매달 ${Utils.formatKoreanCurrency(suggestion.extraMonthly)}(연간 ${Utils.formatKoreanCurrency(extraAnnual)})</strong>을 더 저축하면 계획대로 <strong>${Utils.formatAge(targetAge)}세</strong>에 은퇴가 가능합니다.
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

            if (suggestion.neverReached && !suggestion.extraMonthly && !suggestion.extraReturn) {
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

        const firstLabel = labels.length > 0 ? labels[0] : 0;
        const lastLabel = labels.length > 0 ? labels[labels.length - 1] : 100;

        const annotations = {
            retirementLine: {
                type: 'line', xMin: targetAge, xMax: targetAge, borderColor: 'rgba(100, 116, 139, 0.3)', borderWidth: 1,
                label: {
                    display: targetAge >= firstLabel,
                    content: `${Utils.formatAge(targetAge)}세 은퇴`, position: 'end', backgroundColor: 'rgba(100, 116, 139, 0.8)', font: { size: 10 }
                }
            }
        };

        // 자산 형성기 영역 (은퇴 전인 경우에만 표시)
        if (targetAge > firstLabel) {
            annotations.workingPhase = {
                type: 'box', xMin: firstLabel, xMax: targetAge, backgroundColor: 'rgba(34, 197, 94, 0.03)', borderWidth: 0,
                label: { display: true, content: '저축 및 자산 형성기', position: 'start', font: { size: 11, weight: 'bold', family: 'Noto Sans KR' }, color: 'rgba(34, 197, 94, 0.5)', yAdjust: 10 }
            };
        }

        // 은퇴 및 자산 인출기 영역 (전체 기간 중 은퇴 이후 부분)
        const retirePhaseStart = Math.max(firstLabel, targetAge);
        if (retirePhaseStart < lastLabel) {
            annotations.retirementPhase = {
                type: 'box', xMin: retirePhaseStart, xMax: lastLabel, backgroundColor: 'rgba(249, 115, 22, 0.03)', borderWidth: 0,
                label: { display: true, content: '은퇴 및 자산 인출기', position: 'end', font: { size: 11, weight: 'bold', family: 'Noto Sans KR' }, color: 'rgba(249, 115, 22, 0.5)', yAdjust: 10 }
            };
        }

        if (fireAge !== null && labels.indexOf(fireAge) !== -1) {
            annotations.fireMarker = {
                type: 'point', xValue: fireAge, yValue: balancesAdjusted[labels.indexOf(fireAge)],
                backgroundColor: '#ef4444', radius: 6, borderColor: '#fff', borderWidth: 2,
                label: { display: true, content: 'FIRE 달성!', backgroundColor: '#ef4444', color: '#fff', font: { weight: 'bold', size: 11 }, yAdjust: -20 }
            };
        }

        if (UI.chart) {
            UI.chart.data.labels = labels;
            UI.chart.data.datasets[0].data = balancesAdjusted;
            UI.chart.data.datasets[1].data = balances;
            UI.chart.data.datasets[2].data = labels.map(() => target);
            UI.chart.options.plugins.annotation.annotations = annotations;
            UI.chart.update('none');
            return;
        }

        const gradientNominal = ctx.createLinearGradient(0, 0, 0, 400);
        gradientNominal.addColorStop(0, 'rgba(14, 165, 233, 0.2)');
        gradientNominal.addColorStop(1, 'rgba(14, 165, 233, 0)');

        const gradientReal = ctx.createLinearGradient(0, 0, 0, 400);
        gradientReal.addColorStop(0, 'rgba(2, 132, 199, 0.1)');
        gradientReal.addColorStop(1, 'rgba(2, 132, 199, 0)');

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
                        padding: 12,
                        backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        titleColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#f1f5f9' : '#1e293b',
                        bodyColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#475569',
                        footerColor: '#0284c7', // 강조를 위해 파란색 계열 사용
                        borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#334155' : '#e2e8f0',
                        borderWidth: 1,
                        titleFont: { weight: 'bold', size: 14, family: 'Noto Sans KR' },
                        bodyFont: { family: 'Noto Sans KR' },
                        footerFont: { weight: 'bold', size: 12, family: 'Noto Sans KR' }, // 푸터 글씨 강조
                        callbacks: {
                            title: (items) => `${parseFloat(items[0].label).toFixed(1)}세`,
                            label: (ctx) => ` ${ctx.dataset.label}: ${Utils.formatKoreanCurrency(ctx.raw)}`,
                            footer: (items) => {
                                const age = parseFloat(items[0].label);
                                const res = state.lastResult;
                                if (!res || age < res.pensionStartAge) return '';

                                // 물가가 반영된 명목 연금 수령액 계산
                                const yearsPassed = age - res.currentAge;
                                const nominalPension = res.monthlyPension * Math.pow(1 + res.inflation, yearsPassed);

                                return `\n[수입] 월 예상 연금: ${Utils.formatKoreanCurrency(nominalPension)}\n(물가상승 반영 실지급액)`;
                            }
                        }
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
                            callback: function (value) {
                                const label = this.getLabelForValue(value);
                                return (typeof label === 'number') ? parseFloat(label).toFixed(1) : label;
                            },
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

        const currentAge = Utils.getCurrentAge(birthDateStr) || 50;
        const targetAge = Utils.dateDiffInYears(birthDateStr, retirementDateStr) || (currentAge + 12);
        // 기대수명은 최소한 은퇴나이보다는 크게 설정 (계산 오류 방지)
        const lifeExpectancy = Math.max(targetAge + 1, parseInt(u.lifeExpectancy.value) || 95);
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
        const isAlreadyRetired = targetAge <= currentAge;
        let pensionStartAge = Utils.dateDiffInYears(birthDateStr, startVal);
        if (pensionStartAge === null) pensionStartAge = targetAge;

        // 기준 나이 설정 (이미 은퇴한 경우 현재 나이 기준, 아니면 은퇴 목표 나이 기준)
        const baseCalcAge = Math.max(currentAge, targetAge);

        // 연금 개시까지 남은 기간 (기준 나이 기준)
        const yearsToPensionFromBase = Math.max(0, pensionStartAge - baseCalcAge);
        const actualPensionStartForBase = Math.max(baseCalcAge, pensionStartAge);
        const yearsAfterPensionFromBase = Math.max(0, lifeExpectancy - actualPensionStartForBase);

        // 연금 개시 시점의 목표액 (음수일 경우 연금이 생활비보다 많은 상태)
        const monthlyGapWithPension = monthlyExpenses - monthlyPension;
        const monthlyGapNoPension = monthlyExpenses;

        // 연금이 생활비 이상이면 보존 목표는 필요 없음 (0 처리)
        const preservationTarget = monthlyGapWithPension <= 0 ? 0
            : (realReturn > 0 ? (monthlyGapWithPension * 12) / realReturn : (monthlyGapWithPension * 12) * 25);
        const finalBalanceAtEnd = preservationTarget * preservationRate;

        const targetAtPensionStart = Utils.calculatePV(realReturn, yearsAfterPensionFromBase, monthlyGapWithPension, finalBalanceAtEnd);

        // 기준 나이 시점의 필요 자산 (fireNumber)
        let fireNumber = Utils.calculatePV(realReturn, yearsToPensionFromBase, monthlyGapNoPension, targetAtPensionStart);

        state.futureExpenses.forEach(exp => {
            // 기준 나이 이후의 목돈 지출만 반영
            if (exp.age > baseCalcAge) {
                fireNumber -= exp.amount * Math.pow(1 + realReturn, baseCalcAge - exp.age);
            }
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
        const simStartAge = Math.ceil(currentAge);

        for (let age = simStartAge; age <= maxSimAge; age++) {
            labels.push(age);
            balances.push(Math.round(balance));
            balancesAdjusted.push(Math.round(balanceAdjusted));

            if (fireAge === null && balanceAdjusted >= fireNumber) {
                if (age <= targetAge || isAlreadyRetired) {
                    fireAge = age;
                }
            }

            // 미래 목돈 반영 (해당 나이 연초에 반영)
            state.futureExpenses.forEach(exp => {
                if (exp.age === age) {
                    // 명목 자산에는 물가 상승률만큼 부풀려서 반영 (미래 가치)
                    balance += exp.amount * Math.pow(1 + inflation, age - currentAge);
                    // 실질 자산에는 현재 가치 그대로 반영
                    balanceAdjusted += exp.amount;
                }
            });

            // 월 단위 정밀 시뮬레이션 (12개월 루프)
            for (let m = 0; m < 12; m++) {
                const currentMonthAge = age + (m / 12);
                if (currentMonthAge < targetAge) {
                    // 자산 형성기: 월 복리 수익 + 월 저축액
                    balance = balance * (1 + nominalReturn / 12) + monthlyContribution;
                    balanceAdjusted = balanceAdjusted * (1 + realReturn / 12) + monthlyContribution;
                } else {
                    // 은퇴기: 연금 개시 여부에 따른 차등 적용
                    const isPensionStarted = currentMonthAge >= pensionStartAge;
                    const monthlyGap = isPensionStarted ? monthlyGapWithPension : monthlyGapNoPension;

                    balance = balance * (1 + nominalReturn / 12) - monthlyGap * Math.pow(1 + inflation / 12, (age - simStartAge) * 12 + m);
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
        const yearsLeft = targetAge - currentAge;
        if ((fireAge === null || fireAge > targetAge) && currentSavings < fireNumber && yearsLeft > 0) {
            const r = realReturn / 12, n = yearsLeft * 12;
            const targetIdx = labels.indexOf(targetAge);
            const currentExpectedAtTarget = targetIdx !== -1 ? balancesAdjusted[targetIdx] : 0;
            const shortFall = Math.max(0, fireNumber - currentExpectedAtTarget);

            suggestion = {};

            // 방법 A: 추가 저축 제안
            if (shortFall > 0 && r > 0) {
                suggestion.extraMonthly = shortFall * (r / (Math.pow(1 + r, n) - 1));
            }

            // 방법 B: 수익률 제안 (A와 독립적으로 계산)
            if (currentExpectedAtTarget > 0 && currentExpectedAtTarget < fireNumber) {
                suggestion.extraReturn = (Math.pow(fireNumber / currentExpectedAtTarget, 1 / yearsLeft) - 1) * 100;
            }

            // A도 B도 불가하면 일반 조언
            if (!suggestion.extraMonthly && !suggestion.extraReturn) {
                suggestion.neverReached = true;
            }
        }

        // 시뮬레이션 결과를 state에 저장 (CSV 내보내기 등에서 활용)
        state.lastResult = {
            currentAge, targetAge, lifeExpectancy, fireNumber, fireAge,
            currentSavings, preservationRate, pensionStartAge,
            monthlyGapWithPension, monthlyExpenses, monthlyPension,
            nominalReturn, inflation, realReturn, savingsRate,
            monthlyContribution, labels, balances, balancesAdjusted, suggestion
        };

        Renderer.updateDiagnosisText(preservationRate, lifeExpectancy, targetAge, currentAge, pensionStartAge, monthlyGapWithPension, fireNumber, currentSavings, monthlyExpenses, monthlyPension, suggestion);
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
                if (cfg.id === 'sliderDepletionRate') {
                    this.syncWithdrawalStrategy('slider', slider.value);
                } else {
                    this.updateSliderTooltip(cfg.id, cfg.tooltip, cfg.isReverse);
                    trigger();
                }
            });
            if (numInput) numInput.addEventListener('input', () => {
                if (cfg.id === 'sliderDepletionRate') {
                    this.syncWithdrawalStrategy('input', numInput.value);
                } else {
                    let val = Math.max(parseFloat(numInput.min), Math.min(parseFloat(numInput.max), parseFloat(numInput.value) || 0));
                    slider.value = cfg.isReverse ? 100 - val : val;
                    this.updateSliderTooltip(cfg.id, cfg.tooltip, cfg.isReverse);
                    trigger();
                }
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
                    let year = val.substring(0, 4);
                    let month = val.substring(4, 6);
                    if (month.length === 2) {
                        const m = parseInt(month);
                        if (m < 1) month = '01';
                        if (m > 12) month = '12';
                    }
                    val = year + '-' + month;
                }
                e.target.value = val.substring(0, 7);
            });
        });
    },

    triggerUpdate: Utils.debounce(() => {
        Logic.calculateFIRE();
        App.saveState();
    }, CONFIG.debounceTime),

    updateSliderTooltip(sliderId, tooltipId, isReverse = false) {
        const slider = document.getElementById(sliderId);
        const tooltip = document.getElementById(tooltipId);
        if (!slider || !tooltip) return;

        let val = parseFloat(slider.value);
        const percent = (val - slider.min) / (slider.max - slider.min) * 100;
        if (isReverse) val = 100 - val;

        tooltip.textContent = `${(val % 1 === 0) ? val : val.toFixed(1)}%`;
        slider.style.background = `linear-gradient(to right, var(--primary) ${percent}%, var(--bg-accent) ${percent}%)`;
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
        const selected = e.target.value;
        const presets = { 'preservation': 100, 'depletion': 0, 'partial': 50 };
        if (presets[selected] !== undefined) {
            this.syncWithdrawalStrategy('radio', presets[selected]);
        }
    },

    syncWithdrawalStrategy(source, value) {
        const slider = UI.sliders.depletionRate;
        const numInput = document.getElementById('inputDepletionRate');
        const radios = document.querySelectorAll('input[name="retireModel"]');

        let logicalValue = parseInt(value); // 100(보존) ~ 0(소진)

        // 1. 소스에 따른 값 업데이트
        if (source === 'slider') {
            logicalValue = 100 - parseInt(slider.value);
        } else if (source === 'input') {
            logicalValue = isNaN(logicalValue) ? 100 : Math.max(0, Math.min(100, logicalValue));
        }

        // 2. 다른 UI 요소들로 전파
        if (source !== 'slider') slider.value = 100 - logicalValue;
        if (source !== 'input') numInput.value = logicalValue;

        // 3. 라디오 버튼 상태 업데이트
        let model = 'partial';
        if (logicalValue === 100) model = 'preservation';
        else if (logicalValue === 0) model = 'depletion';

        radios.forEach(r => {
            if (r.value === model) r.checked = true;
        });

        // 4. 시각적 업데이트 (툴팁, 차트)
        this.updateSliderTooltip('sliderDepletionRate', 'tooltipDepletionRate', true);
        this.triggerUpdate();
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

        const currentAge = Utils.getCurrentAge(UI.inputs.birthDate.value);
        if (!age || age < currentAge) return alert('나이 설정을 확인해주세요.');
        if (amt > 0) {
            state.futureExpenses.push({ name, amount: type === 'income' ? amt : -amt, age });
            this.updateExpensesUI();
            this.triggerUpdate();
            this.saveState();
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
            const data = {
                inputs: {},
                futureExpenses: state.futureExpenses,
                retireModel: document.querySelector('input[name="retireModel"]:checked')?.value || 'preservation',
                preservationRateValue: document.getElementById('inputDepletionRate')?.value || "100"
            };
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

            // 저장된 은퇴 전략 불러오기 및 동기화
            if (saved.preservationRateValue !== undefined) {
                this.syncWithdrawalStrategy('input', saved.preservationRateValue);
            } else if (saved.retireModel) {
                const presets = { 'preservation': 100, 'depletion': 0, 'partial': 50 };
                this.syncWithdrawalStrategy('radio', presets[saved.retireModel] || 100);
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

        // 차트를 완전히 파괴 후 재생성하여 테마 색상(그리드, 툴팁 등)을 올바르게 반영
        if (UI.chart) {
            UI.chart.destroy();
            UI.chart = null;
        }
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
        const r = state.lastResult;
        if (!r) { alert('계산 결과가 없습니다. 입력값을 확인해 주세요.'); return; }

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // 전략명
        const rate100 = r.preservationRate * 100;
        let strategyName = rate100 === 100 ? '원금 보존 모델' : (rate100 === 0 ? '원금 소진 모델' : `원금 일부 소진 모델 (${rate100}% 유지)`);

        // 진행률
        const progress = r.fireNumber > 0 ? (r.currentSavings / r.fireNumber) * 100 : 100;

        const rows = [];

        // ── 헤더 ──
        rows.push(['파이어맵 (FIRE Map) | 은퇴 설계 보고서', '']);
        rows.push(['생성 일시', `${dateStr} ${timeStr}`]);
        rows.push(['', '']);

        // ── 1. 기본 정보 ──
        rows.push(['═══ 1. 기본 정보 ═══', '']);
        rows.push(['생년월', UI.inputs.birthDate.value]);
        rows.push(['현재 나이', `${Utils.formatAge(r.currentAge)}세`]);
        rows.push(['목표 은퇴년월', UI.inputs.retirementDate.value]);
        rows.push(['목표 은퇴 나이', `${Utils.formatAge(r.targetAge)}세`]);
        rows.push(['기대 수명 (자산 유지)', `${r.lifeExpectancy}세`]);
        rows.push(['현재 총 자산', `${UI.inputs.currentSavings.value} 만원`]);
        rows.push(['연간 총 소득 (세후)', `${UI.inputs.annualIncome.value} 만원/년`]);
        rows.push(['연간 추가 저축액', `${UI.inputs.annualContribution.value} 만원/년`]);
        rows.push(['은퇴 후 월 생활비 (현재가)', `${UI.inputs.annualExpenses.value} 만원/월`]);
        rows.push(['은퇴 후 월 예상 연금 (현재가)', `${UI.inputs.monthlyPension.value} 만원/월`]);
        rows.push(['연금 개시년월', UI.inputs.pensionStartDate.value]);
        rows.push(['', '']);

        // ── 2. 경제 지표 및 전략 ──
        rows.push(['═══ 2. 경제 지표 및 전략 ═══', '']);
        rows.push(['기대 수익률 (명목)', `${(r.nominalReturn * 100).toFixed(1)}%`]);
        rows.push(['물가 상승률', `${(r.inflation * 100).toFixed(1)}%`]);
        rows.push(['실질 수익률', `${(r.realReturn * 100).toFixed(1)}%`]);
        rows.push(['인출 전략', strategyName]);
        rows.push(['저축률', `${r.savingsRate.toFixed(1)}%`]);
        rows.push(['월 저축액', Utils.formatKoreanCurrency(r.monthlyContribution)]);
        rows.push(['', '']);

        // ── 3. 미래 목돈 계획 ──
        if (state.futureExpenses.length > 0) {
            rows.push(['═══ 3. 미래 목돈 계획 ═══', '']);
            rows.push(['구분', '나이 | 금액']);
            state.futureExpenses.forEach(e => {
                rows.push([`${e.amount > 0 ? '[수입]' : '[지출]'} ${e.name}`, `${e.age}세 | ${Utils.formatKoreanCurrency(e.amount)}`]);
            });
            rows.push(['', '']);
        }

        // ── 4. 진단 결과 ──
        rows.push(['═══ 4. 은퇴 준비 진단 ═══', '']);
        rows.push(['은퇴 목표 금액 (FIRE Number)', Utils.formatKoreanCurrency(Math.max(0, r.fireNumber))]);
        rows.push(['현재 자산', Utils.formatKoreanCurrency(r.currentSavings)]);
        rows.push(['달성률', `${Math.min(progress, 999.9).toFixed(1)}%`]);
        rows.push(['남은 시간', UI.displays.yearsToFire.textContent]);
        rows.push(['달성 예상', UI.displays.ageAtFire.textContent]);
        rows.push(['상태', UI.displays.statusMessage.textContent]);

        // 브릿지 기간
        const bridgePeriod = Math.max(0, r.pensionStartAge - r.targetAge);
        if (bridgePeriod > 0) {
            rows.push(['연금 공백기 (브릿지)', `${Utils.formatAge(bridgePeriod)}년`]);
        }
        rows.push(['', '']);

        // ── 5. 목표 달성 제안 ──
        if (r.suggestion) {
            rows.push(['═══ 5. 목표 달성을 위한 제안 ═══', '']);
            if (r.suggestion.extraMonthly) {
                const extraAnnual = r.suggestion.extraMonthly * 12;
                rows.push(['방법 A: 추가 저축', `매달 ${Utils.formatKoreanCurrency(r.suggestion.extraMonthly)} (연간 ${Utils.formatKoreanCurrency(extraAnnual)}) 추가 시 ${Utils.formatAge(r.targetAge)}세 은퇴 가능`]);
            }
            if (r.suggestion.extraReturn && r.suggestion.extraReturn < 20) {
                rows.push(['방법 B: 수익률 조정', `연평균 수익률을 ${r.suggestion.extraReturn.toFixed(1)}%p 더 높이면 목표 달성 가능`]);
            }

            if (r.suggestion.neverReached && !r.suggestion.extraMonthly && !r.suggestion.extraReturn) {
                rows.push(['조언', '현재 설정으로는 현실적인 대안을 계산하기 어렵습니다. 목표 금액을 낮추거나 은퇴 나이를 조정해 보세요.']);
            }
            rows.push(['', '']);
        }

        // ── 6. 연간 시뮬레이션 테이블 ──
        rows.push(['═══ 6. 연간 자산 시뮬레이션 ═══', '', '', '']);
        rows.push(['나이', '예상 자산 (명목)', '실질 가치 (구매력)', '은퇴 목표선']);
        const targetLine = Math.max(0, r.fireNumber);
        for (let i = 0; i < r.labels.length; i++) {
            rows.push([
                `${Utils.formatAge(r.labels[i])}세`,
                Utils.formatKoreanCurrency(r.balances[i]),
                Utils.formatKoreanCurrency(r.balancesAdjusted[i]),
                Utils.formatKoreanCurrency(targetLine)
            ]);
        }
        rows.push(['', '']);

        // ── 푸터 ──
        rows.push(['═══ 면책 사항 ═══', '']);
        rows.push(['', '본 보고서는 교육 및 참고용이며 금융/투자/세무/법률적 자문이 아닙니다.']);
        rows.push(['', '실제 결과는 다를 수 있으며 중요한 재무 결정 전에는 전문가와 상담하시기 바랍니다.']);
        rows.push(['', '']);
        rows.push(['생성 도구', '파이어맵 (FIRE Map) | https://happyretire.github.io/FIRE-Map/']);
        rows.push(['creator', 'ⓒ Dunam | cafe.naver.com/retireclass']);

        // CSV 생성 및 다운로드
        const maxCols = Math.max(...rows.map(r => r.length));
        const csv = "\ufeff" + rows.map(row => {
            while (row.length < maxCols) row.push('');
            return row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
        }).join('\n');

        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        link.download = `FIRE_은퇴계획서_${dateStr}.csv`;
        link.click();
    }
};

// Global accessor for inline HTML calls
window.App = App;

// Initial start
document.addEventListener('DOMContentLoaded', () => App.init());
