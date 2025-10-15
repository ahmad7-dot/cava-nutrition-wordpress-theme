<?php
/**
 * Template Name: Nutrition Database
 * Description: Cava Nutrition Database Page
 */

if (!defined('ABSPATH')) exit;
get_header();
?>

<main id="main-content">
    <section class="database-page">
        <div class="container">
            <h1><?php _e('Nutrition Database', 'cava-nutrition'); ?></h1>
            <p><?php _e('Search and explore nutritional information for all Cava ingredients', 'cava-nutrition'); ?></p>
            
            <div class="search-and-filter">
                <input type="text" id="search-input" placeholder="<?php _e('Search ingredients...', 'cava-nutrition'); ?>" />
                <div class="category-filters" id="db-categories"></div>
            </div>
            
            <p class="item-count"><span id="item-count">0</span> <?php _e('items found', 'cava-nutrition'); ?></p>
            <div class="database-grid" id="database-grid"></div>
        </div>
    </section>
</main>

<script id="db-data" type="application/json">
<?php echo wp_json_encode(cava_get_nutrition_data()); ?>
</script>

<script>
(function() {
    let allItems = [];
    let searchTerm = '';
    let categoryFilter = 'all';

    function init() {
        const data = JSON.parse(document.getElementById('db-data').textContent);
        
        Object.keys(data).forEach(category => {
            data[category].forEach(item => allItems.push({...item, category}));
        });

        renderCategories(Object.keys(data));
        renderItems(allItems);
        attachListeners();
    }

    function renderCategories(categories) {
        const html = ['<button class="active" data-category="all">All Items</button>']
            .concat(categories.map(cat => `<button data-category="${cat}">${cat}</button>`))
            .join('');
        document.getElementById('db-categories').innerHTML = html;
    }

    function filterItems() {
        let filtered = allItems;

        if (searchTerm) {
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (categoryFilter !== 'all') {
            filtered = filtered.filter(item => item.category === categoryFilter);
        }

        renderItems(filtered);
    }

    function renderItems(items) {
        document.getElementById('item-count').textContent = items.length;
        document.getElementById('database-grid').innerHTML = items.map(item => `
            <div class="db-item-card">
                <div class="card-header">
                    <h3>${item.name}</h3>
                    <span class="calories">${item.calories}</span>
                </div>
                <div class="db-grid">
                    <div><p>Protein</p><span>${item.protein}g</span></div>
                    <div><p>Carbs</p><span>${item.carbs}g</span></div>
                    <div><p>Fat</p><span>${item.fat}g</span></div>
                    <div><p>Fiber</p><span>${item.fiber}g</span></div>
                    <div><p>Sodium</p><span>${item.sodium}mg</span></div>
                </div>
                <div class="card-footer">
                    ${item.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }

    function attachListeners() {
        document.getElementById('search-input').addEventListener('input', (e) => {
            searchTerm = e.target.value;
            filterItems();
        });

        document.getElementById('db-categories').addEventListener('click', (e) => {
            if (e.target.matches('button')) {
                document.querySelectorAll('#db-categories button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                categoryFilter = e.target.dataset.category;
                filterItems();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
</script>

<?php get_footer(); ?>
