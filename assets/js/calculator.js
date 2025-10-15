/**
 * Cava Nutrition Calculator - Main Logic
 */

(function() {
    'use strict';

    let currentStep = 0;
    let nutritionData = {};
    let selections = [];
    let mealType = null;

    const steps = [
        { name: 'Meal Type', category: 'MealType', icon: '🍲' },
        { name: 'Base', category: 'Bases', icon: '🥗' },
        { name: 'Protein', category: 'Proteins', icon: '🍗' },
        { name: 'Dips', category: 'Dips', icon: '🥣' },
        { name: 'Toppings', category: 'Toppings', icon: '🥬' },
        { name: 'Dressing', category: 'Dressings', icon: '🧴' },
        { name: 'Summary', category: 'Summary', icon: '📋' },
    ];

    // Initialize calculator
    function init() {
        loadNutritionData();
        renderProgressBar();
        renderStep();
        attachEventListeners();
    }

    // Load nutrition data from server
    function loadNutritionData() {
        const dataElement = document.getElementById('nutrition-data');
        if (dataElement) {
            try {
                nutritionData = JSON.parse(dataElement.textContent);
            } catch (e) {
                console.error('Failed to parse nutrition data', e);
                nutritionData = {};
            }
        }
    }

    // Render progress bar
    function renderProgressBar() {
        const progressBar = document.getElementById('progress-bar');
        if (!progressBar) return;

        progressBar.innerHTML = steps.map((step, index) => {
            const classes = ['progress-step'];
            if (index === currentStep) classes.push('active');
            if (index < currentStep) classes.push('completed');

            return `
                <div class="${classes.join(' ')}">
                    <div class="step-icon">${step.icon}</div>
                    <span>${step.name}</span>
                </div>
            `;
        }).join('');
    }

    // Render current step
    function renderStep() {
        const container = document.getElementById('calculator-steps');
        if (!container) return;

        const step = steps[currentStep];
        let html = '';

        if (step.category === 'MealType') {
            html = renderMealTypeStep();
        } else if (step.category === 'Summary') {
            html = renderSummaryStep();
        } else {
            html = renderOptionsStep(step);
        }

        container.innerHTML = html;
        updateNavigationButtons();
        updateStepCounter();
    }

    // Meal type selection
    function renderMealTypeStep() {
        return `
            <div class="step-content meal-type">
                <h2>Select Your Meal Type</h2>
                <p>Choose between a bowl or pita to start building your meal</p>
                <div class="options-grid">
                    <div class="option-card ${mealType === 'Bowl' ? 'selected' : ''}" data-meal-type="Bowl">
                        <div class="card-icon">🥗</div>
                        <h3>Bowl</h3>
                        <p>Customizable bowl with your choice of base</p>
                    </div>
                    <div class="option-card ${mealType === 'Pita' ? 'selected' : ''}" data-meal-type="Pita">
                        <div class="card-icon">🥙</div>
                        <h3>Pita</h3>
                        <p>Warm pita wrap with your favorite fillings</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Options selection (bases, proteins, etc.)
    function renderOptionsStep(step) {
        const items = nutritionData[step.category] || [];
        const multiSelect = ['Dips', 'Toppings'].includes(step.category);

        let html = `
            <div class="step-content">
                <h2>Select Your ${step.name}</h2>
                <p>${multiSelect ? 'Choose one or more options' : 'Choose one option'} below.</p>
                <div class="options-grid item-grid">
        `;

        items.forEach(item => {
            const isSelected = selections.some(s => s.name === item.name);
            html += `
                <div class="option-card item-card ${isSelected ? 'selected' : ''}" data-item='${JSON.stringify(item)}'>
                    <h3>${item.name}</h3>
                    <p class="calories">${item.calories} cal</p>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    // Summary step
    function renderSummaryStep() {
        let html = `
            <div class="step-content summary-view">
                <h2>Your Meal Summary</h2>
                <p>Review your selections and final nutrition information.</p>
                <div class="final-summary-grid">
        `;

        selections.forEach(item => {
            html += `
                <div class="summary-item-card">
                    <strong>${item.name}</strong><span>${item.calories} cal</span>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    // Update nutrition summary
    function updateNutritionSummary() {
        const totals = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            sodium: 0,
        };

        selections.forEach(item => {
            totals.calories += item.calories || 0;
            totals.protein += item.protein || 0;
            totals.carbs += item.carbs || 0;
            totals.fat += item.fat || 0;
            totals.fiber += item.fiber || 0;
            totals.sodium += item.sodium || 0;
        });

        document.getElementById('total-calories').textContent = totals.calories;
        document.getElementById('total-protein').textContent = Math.round(totals.protein * 10) / 10 + 'g';
        document.getElementById('total-carbs').textContent = Math.round(totals.carbs * 10) / 10 + 'g';
        document.getElementById('total-fat').textContent = Math.round(totals.fat * 10) / 10 + 'g';
        document.getElementById('total-fiber').textContent = Math.round(totals.fiber * 10) / 10 + 'g';
        document.getElementById('total-sodium').textContent = totals.sodium + 'mg';

        const list = document.getElementById('selections-list');
        list.innerHTML = selections.map((item, index) => 
            `<li>${item.name}</li>`
        ).join('');
    }

    // Update navigation buttons
    function updateNavigationButtons() {
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');

        if (btnPrev) {
            btnPrev.disabled = currentStep === 0;
        }

        if (btnNext) {
            const isLastStep = currentStep === steps.length - 1;
            const canProceed = currentStep === 0 ? mealType : true;
            btnNext.disabled = isLastStep || !canProceed;
        }
    }

    // Update step counter
    function updateStepCounter() {
        const counter = document.getElementById('step-counter');
        if (counter) {
            counter.textContent = `Step ${currentStep + 1} of ${steps.length}`;
        }
    }

    // Attach event listeners
    function attachEventListeners() {
        // Next/Previous buttons
        document.getElementById('btn-prev')?.addEventListener('click', () => {
            if (currentStep > 0) {
                currentStep--;
                renderProgressBar();
                renderStep();
            }
        });

        document.getElementById('btn-next')?.addEventListener('click', () => {
            if (currentStep < steps.length - 1) {
                currentStep++;
                renderProgressBar();
                renderStep();
            }
        });

        // Step content delegation
        document.getElementById('calculator-steps')?.addEventListener('click', (e) => {
            const mealTypeCard = e.target.closest('[data-meal-type]');
            if (mealTypeCard) {
                mealType = mealTypeCard.dataset.mealType;
                renderStep();
                return;
            }

            const itemCard = e.target.closest('[data-item]');
            if (itemCard) {
                const item = JSON.parse(itemCard.dataset.item);
                const step = steps[currentStep];
                const multiSelect = ['Dips', 'Toppings'].includes(step.category);

                if (multiSelect) {
                    const index = selections.findIndex(s => s.name === item.name);
                    if (index > -1) {
                        selections.splice(index, 1);
                    } else {
                        selections.push(item);
                    }
                } else {
                    selections = selections.filter(s => !nutritionData[step.category]?.some(catItem => catItem.name === s.name));
                    selections.push(item);
                }

                updateNutritionSummary();
                renderStep();
            }
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
