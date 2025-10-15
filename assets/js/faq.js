/**
 * FAQ Accordion Functionality
 */

(function() {
    'use strict';

    let openIndex = null;

    function init() {
        attachEventListeners();
        setupSearchFunctionality();
    }

    function attachEventListeners() {
        document.addEventListener('click', (e) => {
            const question = e.target.closest('.faq-question');
            if (!question) return;

            const wrapper = question.closest('.faq-item-wrapper');
            const answer = wrapper.querySelector('.faq-answer');
            const arrow = question.querySelector('.arrow');
            const index = question.dataset.index;

            // Close previously open item
            if (openIndex !== null && openIndex !== index) {
                const prevOpen = document.querySelector(`[data-index="${openIndex}"]`);
                if (prevOpen) {
                    const prevAnswer = prevOpen.closest('.faq-item-wrapper').querySelector('.faq-answer');
                    const prevArrow = prevOpen.querySelector('.arrow');
                    prevAnswer.classList.remove('open');
                    prevArrow.classList.remove('open');
                }
            }

            // Toggle current item
            answer.classList.toggle('open');
            arrow.classList.toggle('open');
            openIndex = answer.classList.contains('open') ? index : null;
        });
    }

    function setupSearchFunctionality() {
        const searchInput = document.getElementById('faq-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const questions = document.querySelectorAll('.faq-question span:first-child');

            questions.forEach(question => {
                const wrapper = question.closest('.faq-item-wrapper');
                const questionText = question.textContent.toLowerCase();
                const answer = wrapper.querySelector('.faq-answer p');
                const answerText = answer ? answer.textContent.toLowerCase() : '';

                const matches = questionText.includes(searchTerm) || answerText.includes(searchTerm);
                wrapper.style.display = matches ? '' : 'none';
            });
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
