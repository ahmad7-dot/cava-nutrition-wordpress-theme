<?php
/**
 * Cava Nutrition Calculator Theme Functions
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CAVA_THEME_DIR', get_template_directory());
define('CAVA_THEME_URI', get_template_directory_uri());
define('CAVA_ASSETS_URI', CAVA_THEME_URI . '/assets');

/**
 * Theme Setup
 */
function cava_theme_setup() {
    // Add theme support
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('custom-logo');
    add_theme_support('html5', array('search-form', 'comment-form', 'comment-list'));
    
    // Register menu location
    register_nav_menus(array(
        'primary' => __('Primary Menu', 'cava-nutrition'),
        'footer' => __('Footer Menu', 'cava-nutrition'),
    ));
}
add_action('after_setup_theme', 'cava_theme_setup');

/**
 * Enqueue Scripts and Styles
 */
function cava_enqueue_assets() {
    // Google Fonts
    wp_enqueue_style('google-fonts', 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap', array(), null);
    
    // Main stylesheet
    wp_enqueue_style('cava-main', get_stylesheet_uri(), array(), '1.0.0');
    
    // Main JavaScript
    wp_enqueue_script('cava-main', CAVA_ASSETS_URI . '/js/main.js', array(), '1.0.0', true);
    
    // Calculator JavaScript
    wp_enqueue_script('cava-calculator', CAVA_ASSETS_URI . '/js/calculator.js', array('cava-main'), '1.0.0', true);
    
    // FAQ JavaScript
    wp_enqueue_script('cava-faq', CAVA_ASSETS_URI . '/js/faq.js', array('cava-main'), '1.0.0', true);
    
    // Localize script for AJAX
    wp_localize_script('cava-calculator', 'cavaAjax', array(
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('cava_nonce'),
    ));
}
add_action('wp_enqueue_scripts', 'cava_enqueue_assets');

/**
 * Custom Post Type: Nutrition Items
 */
function cava_register_nutrition_post_type() {
    $args = array(
        'label' => __('Nutrition Items', 'cava-nutrition'),
        'public' => true,
        'show_in_menu' => true,
        'show_in_rest' => true,
        'supports' => array('title', 'editor', 'thumbnail'),
        'has_archive' => true,
        'rewrite' => array('slug' => 'nutrition-item'),
        'menu_icon' => 'dashicons-carrot',
    );
    register_post_type('nutrition_item', $args);
}
add_action('init', 'cava_register_nutrition_post_type');

/**
 * Custom Taxonomy: Nutrition Categories
 */
function cava_register_nutrition_taxonomy() {
    $args = array(
        'label' => __('Nutrition Categories', 'cava-nutrition'),
        'public' => true,
        'show_in_rest' => true,
        'hierarchical' => true,
    );
    register_taxonomy('nutrition_category', 'nutrition_item', $args);
}
add_action('init', 'cava_register_nutrition_taxonomy');

/**
 * Register Metaboxes for Nutrition Items
 */
function cava_register_metaboxes() {
    add_meta_box(
        'nutrition_data',
        __('Nutrition Information', 'cava-nutrition'),
        'cava_nutrition_metabox_callback',
        'nutrition_item',
        'normal',
        'high'
    );
}
add_action('add_meta_boxes', 'cava_register_metaboxes');

function cava_nutrition_metabox_callback($post) {
    wp_nonce_field('cava_nutrition_nonce', 'cava_nutrition_nonce');
    
    $nutrition_data = get_post_meta($post->ID, 'cava_nutrition_data', true);
    $nutrition_data = wp_parse_args($nutrition_data, array(
        'calories' => 0,
        'protein' => 0,
        'carbs' => 0,
        'fat' => 0,
        'fiber' => 0,
        'sodium' => 0,
        'tags' => '',
    ));
    ?>
    <table class="form-table">
        <tr>
            <th><label for="calories"><?php _e('Calories', 'cava-nutrition'); ?></label></th>
            <td><input type="number" id="calories" name="nutrition[calories]" value="<?php echo esc_attr($nutrition_data['calories']); ?>" /></td>
        </tr>
        <tr>
            <th><label for="protein"><?php _e('Protein (g)', 'cava-nutrition'); ?></label></th>
            <td><input type="number" id="protein" name="nutrition[protein]" value="<?php echo esc_attr($nutrition_data['protein']); ?>" step="0.1" /></td>
        </tr>
        <tr>
            <th><label for="carbs"><?php _e('Carbs (g)', 'cava-nutrition'); ?></label></th>
            <td><input type="number" id="carbs" name="nutrition[carbs]" value="<?php echo esc_attr($nutrition_data['carbs']); ?>" step="0.1" /></td>
        </tr>
        <tr>
            <th><label for="fat"><?php _e('Fat (g)', 'cava-nutrition'); ?></label></th>
            <td><input type="number" id="fat" name="nutrition[fat]" value="<?php echo esc_attr($nutrition_data['fat']); ?>" step="0.1" /></td>
        </tr>
        <tr>
            <th><label for="fiber"><?php _e('Fiber (g)', 'cava-nutrition'); ?></label></th>
            <td><input type="number" id="fiber" name="nutrition[fiber]" value="<?php echo esc_attr($nutrition_data['fiber']); ?>" step="0.1" /></td>
        </tr>
        <tr>
            <th><label for="sodium"><?php _e('Sodium (mg)', 'cava-nutrition'); ?></label></th>
            <td><input type="number" id="sodium" name="nutrition[sodium]" value="<?php echo esc_attr($nutrition_data['sodium']); ?>" /></td>
        </tr>
        <tr>
            <th><label for="tags"><?php _e('Tags (comma-separated)', 'cava-nutrition'); ?></label></th>
            <td><input type="text" id="tags" name="nutrition[tags]" value="<?php echo esc_attr($nutrition_data['tags']); ?>" placeholder="Vegan, Gluten-Free" /></td>
        </tr>
    </table>
    <?php
}

/**
 * Save Nutrition Metabox Data
 */
function cava_save_nutrition_metabox($post_id) {
    if (!isset($_POST['cava_nutrition_nonce']) || !wp_verify_nonce($_POST['cava_nutrition_nonce'], 'cava_nutrition_nonce')) {
        return;
    }
    
    if (isset($_POST['nutrition'])) {
        $nutrition_data = array_map('sanitize_text_field', $_POST['nutrition']);
        update_post_meta($post_id, 'cava_nutrition_data', $nutrition_data);
    }
}
add_action('save_post', 'cava_save_nutrition_metabox');

/**
 * AJAX: Get Nutrition Items
 */
function cava_get_nutrition_items() {
    check_ajax_referer('cava_nonce', 'nonce');
    
    $category = isset($_POST['category']) ? sanitize_text_field($_POST['category']) : '';
    
    $args = array(
        'post_type' => 'nutrition_item',
        'posts_per_page' => -1,
    );
    
    if ($category && $category !== 'all') {
        $args['tax_query'] = array(
            array(
                'taxonomy' => 'nutrition_category',
                'field' => 'slug',
                'terms' => $category,
            ),
        );
    }
    
    $query = new WP_Query($args);
    $items = array();
    
    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $nutrition = get_post_meta(get_the_ID(), 'cava_nutrition_data', true);
            $items[] = array(
                'id' => get_the_ID(),
                'name' => get_the_title(),
                'nutrition' => $nutrition,
                'tags' => wp_get_post_terms(get_the_ID(), 'nutrition_category', array('fields' => 'names')),
            );
        }
        wp_reset_postdata();
    }
    
    wp_send_json_success($items);
}
add_action('wp_ajax_cava_get_items', 'cava_get_nutrition_items');
add_action('wp_ajax_nopriv_cava_get_items', 'cava_get_nutrition_items');

/**
 * Get Nutrition Data as JSON (for calculator)
 */
function cava_get_nutrition_json() {
    $transient = get_transient('cava_nutrition_json');
    
    if (false === $transient) {
        $args = array(
            'post_type' => 'nutrition_item',
            'posts_per_page' => -1,
            'orderby' => 'taxonomy',
            'order' => 'ASC',
        );
        
        $query = new WP_Query($args);
        $nutrition_data = array();
        
        if ($query->have_posts()) {
            while ($query->have_posts()) {
                $query->the_post();
                $categories = wp_get_post_terms(get_the_ID(), 'nutrition_category', array('fields' => 'names'));
                $nutrition = get_post_meta(get_the_ID(), 'cava_nutrition_data', true);
                
                if (!empty($categories)) {
                    $category = $categories[0];
                    if (!isset($nutrition_data[$category])) {
                        $nutrition_data[$category] = array();
                    }
                    
                    $nutrition_data[$category][] = array(
                        'name' => get_the_title(),
                        'calories' => intval($nutrition['calories'] ?? 0),
                        'protein' => floatval($nutrition['protein'] ?? 0),
                        'carbs' => floatval($nutrition['carbs'] ?? 0),
                        'fat' => floatval($nutrition['fat'] ?? 0),
                        'fiber' => floatval($nutrition['fiber'] ?? 0),
                        'sodium' => intval($nutrition['sodium'] ?? 0),
                        'tags' => array_filter(array_map('trim', explode(',', $nutrition['tags'] ?? ''))),
                    );
                }
            }
            wp_reset_postdata();
        }
        
        $transient = wp_json_encode($nutrition_data);
        set_transient('cava_nutrition_json', $transient, HOUR_IN_SECONDS);
    }
    
    return $transient;
}

/**
 * Clear Nutrition Cache
 */
function cava_clear_nutrition_cache($post_id) {
    if (get_post_type($post_id) === 'nutrition_item') {
        delete_transient('cava_nutrition_json');
    }
}
add_action('save_post', 'cava_clear_nutrition_cache');
add_action('delete_post', 'cava_clear_nutrition_cache');

/**
 * Admin Body Class
 */
function cava_admin_body_class($classes) {
    return $classes . ' cava-admin';
}
add_filter('admin_body_class', 'cava_admin_body_class');

/**
 * Disable Comments
 */
function cava_disable_comments() {
    return false;
}
add_filter('comments_open', 'cava_disable_comments');
add_filter('pings_open', 'cava_disable_comments');

/**
 * Helper: Get Nutrition Data for Frontend
 */
function cava_get_nutrition_data() {
    return cava_get_nutrition_json();
}
