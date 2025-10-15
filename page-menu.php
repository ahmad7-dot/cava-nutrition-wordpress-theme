<?php
/**
 * Template Name: Menu
 * Description: Cava Menu Page
 */

if (!defined('ABSPATH')) exit;
get_header();
?>

<main id="main-content">
    <section class="menu-page">
        <div class="container">
            <h1><?php _e('Cava Menu', 'cava-nutrition'); ?></h1>
            <p><?php _e('Explore all available ingredients and their nutritional information', 'cava-nutrition'); ?></p>
            
            <div class="filters">
                <div class="main-filters" id="main-filters">
                    <button class="active" data-filter="all"><?php _e('All Items', 'cava-nutrition'); ?></button>
                    <button data-filter="vegan"><?php _e('Vegan', 'cava-nutrition'); ?></button>
                    <button data-filter="glutenfree"><?php _e('Gluten-Free', 'cava-nutrition'); ?></button>
                </div>
                <div class="category-filters" id="category-filters">
                    <!-- Categories loaded dynamically -->
                </div>
            </div>
            
            <div class="menu-grid" id="menu-grid">
                <!-- Menu items loaded dynamically -->
            </div>
        </div>
    </section>
</main>

<script id="menu-data" type="application/json">
<?php echo wp_json_encode(cava_get_nutrition_data()); ?>
</script>

<script>
(function() {
    let allItems = [];
    let currentFilter = 'all';
    let currentCategory = '';

    function init() {
        const dataEl = document.getElementById('menu-data');
        const data = JSON.parse(dataEl.textContent);
        
        Object.keys(data).forEach(category => {
            data[category].forEach(item => allItems.push({...item, category}));
        });

        renderCategories(Object.keys(data));
        renderMenuItems(allItems);
        attachFilters();
    }

    function renderCategories(categories) {
        const container = document.getElementById('category-filters');
        container.innerHTML = categories.map(cat => 
            `<button data-category="${cat}">${cat}</button>`
        ).join('');
    }

    function filterItems() {
        let filtered = allItems;

        if (currentFilter !== 'all') {
            filtered = filtered.filter(item => 
                item.tags && item.tags.some(tag => 
                    tag.toLowerCase().includes(currentFilter)
                )
            );
        }

        if (currentCategory) {
            filtered = filtered.filter(item => item.category === currentCategory);
        }

        renderMenuItems(filtered);
    }

    function renderMenuItems(items) {
        const grid = document.getElementById('menu-grid');
        grid.innerHTML = items.map(item => `
            <div class="menu-item-card">
                <div class="card-header">
                    <h3>${item.name}</h3>
                    <span class="calories">${item.calories} cal</span>
                </div>
                <div class="card-body">
                    <p>Protein: ${item.protein}g</p>
                    <p>Carbs: ${item.carbs}g</p>
                    <p>Fat: ${item.fat}g</p>
                </div>
                <div class="card-footer">
                    ${item.tags.map(tag => `<span class="tag ${tag.toLowerCase().replace('-', '')}">${tag}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }

    function attachFilters() {
        document.getElementById('main-filters').addEventListener('click', (e) => {
            if (e.target.matches('button')) {
                document.querySelectorAll('#main-filters button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentFilter = e.target.dataset.filter;
                filterItems();
            }
        });

        document.getElementById('category-filters').addEventListener('click', (e) => {
            if (e.target.matches('button')) {
                currentCategory = e.target.dataset.category === currentCategory ? '' : e.target.dataset.category;
                filterItems();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
</script>

<?php get_footer(); ?>
