<?php
/**
 * Template Name: FAQ
 * Description: Cava FAQ Page
 */

if (!defined('ABSPATH')) exit;
get_header();

$faq_data = array(
    'General Questions' => array(
        array('q' => 'Is the nutrition information accurate?', 'a' => 'Yes, we strive for accuracy by using the latest publicly available data from official sources and cross-checking with nutritional databases.'),
        array('q' => 'How often is the nutrition data updated?', 'a' => 'We update our database whenever new menu items are released or existing information changes. Updates are typically processed within 24 hours.'),
        array('q' => 'Is this website affiliated with Cava?', 'a' => 'No, this is an independent project created by fans to help others make informed food choices. We are not affiliated with, endorsed by, or connected to Cava Grill.'),
    ),
    'Calculator Usage' => array(
        array('q' => 'How do I use the Nutrition Calculator?', 'a' => 'Simply follow the step-by-step process, selecting one item from each category to build your meal. The nutrition summary updates in real-time.'),
        array('q' => 'How can I find heart-healthy options?', 'a' => 'Look for items with lower sodium and saturated fat content. We also provide a "Heart-Healthy Recommendation" on the homepage.'),
        array('q' => 'Does the calculator account for portion sizes?', 'a' => 'The calculator uses standard portion sizes as provided by official nutritional information. Custom portion sizes are not available at this time.'),
        array('q' => 'Can I save my custom meal creations?', 'a' => 'Currently, you cannot save meals to your account. However, you can take a screenshot of the final nutrition summary.'),
    ),
    'Nutrition Information' => array(
        array('q' => 'What are the healthiest base options?', 'a' => 'SuperGreens (15 cal) is the lightest option. Brown rice and black lentils offer more fiber. Choose based on your dietary goals.'),
        array('q' => 'Which proteins are lowest in calories?', 'a' => 'Grilled chicken (190 cal) is one of the lowest-calorie protein options. Roasted vegetables are also lower at 90 cal.'),
        array('q' => 'How can I reduce sodium in my meal?', 'a' => 'Avoid multiple dips and creamy dressings. Opt for vinaigrette-based dressings and fresh vegetables without added salt.'),
    ),
    'Allergens & Dietary Restrictions' => array(
        array('q' => 'How do I know if an item contains allergens?', 'a' => 'Items are tagged with dietary information including "Vegan" and "Gluten-Free". Use the filter buttons to find items that match your needs.'),
        array('q' => 'Which items are dairy-free?', 'a' => 'Look for items NOT tagged with dairy indicators. Most vegetables, grains, and vegan proteins are dairy-free. Always verify with staff.'),
        array('q' => 'Are there vegetarian and vegan options?', 'a' => 'Yes! Many items are naturally plant-based including falafel, hummus, vegetables, and grains. Filter by "Vegan" to see all options.'),
    ),
);
?>

<main id="main-content">
    <section class="faq-page">
        <div class="container">
            <h1><?php _e('Frequently Asked Questions', 'cava-nutrition'); ?></h1>
            <p class="subtitle"><?php _e('Find answers to common questions about our Nutrition Calculator and making healthier choices.', 'cava-nutrition'); ?></p>
            
            <div class="faq-search-wrapper">
                <input type="text" class="faq-search" id="faq-search" placeholder="<?php _e('Search for a question...', 'cava-nutrition'); ?>" />
            </div>
            
            <div class="faq-grid">
                <?php foreach ($faq_data as $category => $questions) : ?>
                    <div class="faq-category">
                        <h3><?php echo esc_html($category); ?></h3>
                        <div class="faq-accordion">
                            <?php foreach ($questions as $index => $item) : ?>
                                <div class="faq-item-wrapper">
                                    <div class="faq-question" data-index="<?php echo esc_attr($index); ?>">
                                        <span><?php echo esc_html($item['q']); ?></span>
                                        <span class="arrow">▼</span>
                                    </div>
                                    <div class="faq-answer">
                                        <p><?php echo esc_html($item['a']); ?></p>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </section>
</main>

<?php get_footer(); ?>
