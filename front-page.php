<?php
/**
 * Front Page Template (Homepage)
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();
?>

<main id="main-content">
    <!-- Hero Section -->
    <section class="hero">
        <div class="container">
            <div class="hero-content">
                <h1><?php _e('Cava Nutrition & Calorie Calculator', 'cava-nutrition'); ?></h1>
                <p><?php _e('Make smarter meal choices with our Cava Nutrition Calculator. Instantly track calories, macros, sodium, and more.', 'cava-nutrition'); ?></p>
                <div class="hero-buttons">
                    <button class="btn btn-primary" onclick="document.getElementById('calculator-section').scrollIntoView({behavior: 'smooth'});">
                        <?php _e('Try Our Calculator →', 'cava-nutrition'); ?>
                    </button>
                    <a href="<?php echo esc_url(home_url('/nutrition-database')); ?>" class="btn btn-secondary">
                        <?php _e('View Nutrition Database →', 'cava-nutrition'); ?>
                    </a>
                </div>
                <div class="hero-features">
                    <span>✓ <?php _e('Real-time Updates', 'cava-nutrition'); ?></span>
                    <span>✓ <?php _e('Fully Customizable', 'cava-nutrition'); ?></span>
                    <span>✓ <?php _e('Heart-Healthy Options', 'cava-nutrition'); ?></span>
                </div>
            </div>
            <div class="hero-image">
                <div class="nutrition-card-summary">
                    <h4>❤️ <?php _e('Healthy Choice Recommendation', 'cava-nutrition'); ?></h4>
                    <ul>
                        <li><span><?php _e('SuperGreens Base', 'cava-nutrition'); ?></span> <span>15 cal</span></li>
                        <li><span><?php _e('Grilled Chicken', 'cava-nutrition'); ?></span> <span>190 cal</span></li>
                        <li><span><?php _e('Classic Hummus', 'cava-nutrition'); ?></span> <span>100 cal</span></li>
                        <li><span><?php _e('All Veggies', 'cava-nutrition'); ?></span> <span>50 cal</span></li>
                        <li><span><?php _e('Greek Vinaigrette', 'cava-nutrition'); ?></span> <span>90 cal</span></li>
                    </ul>
                    <div class="total"><span><?php _e('Total', 'cava-nutrition'); ?></span><span>445 calories</span></div>
                    <p class="heart-check">♡ <?php _e('Heart-Check Certified', 'cava-nutrition'); ?></p>
                </div>
            </div>
        </div>
    </section>

    <!-- Calculator Section -->
    <section id="calculator-section" class="calculator-page">
        <div class="container">
            <div id="calculator-app" class="calculator-content">
                <div class="calculator-main">
                    <div class="progress-bar" id="progress-bar"></div>
                    <div id="calculator-steps"></div>
                    <div class="navigation-buttons">
                        <button class="btn btn-secondary" id="btn-prev" disabled>
                            <?php _e('← Previous', 'cava-nutrition'); ?>
                        </button>
                        <span id="step-counter"></span>
                        <button class="btn btn-primary" id="btn-next">
                            <?php _e('Next →', 'cava-nutrition'); ?>
                        </button>
                    </div>
                </div>
                <aside class="nutrition-summary">
                    <h4>📊 <?php _e('Nutrition Summary', 'cava-nutrition'); ?></h4>
                    <div class="summary-card total-calories">
                        <p><?php _e('Total Calories', 'cava-nutrition'); ?></p>
                        <span id="total-calories">0</span>
                    </div>
                    <div class="summary-grid">
                        <div class="summary-card"><p><?php _e('Protein', 'cava-nutrition'); ?></p><span id="total-protein">0g</span></div>
                        <div class="summary-card"><p><?php _e('Carbs', 'cava-nutrition'); ?></p><span id="total-carbs">0g</span></div>
                        <div class="summary-card"><p><?php _e('Fat', 'cava-nutrition'); ?></p><span id="total-fat">0g</span></div>
                        <div class="summary-card"><p><?php _e('Fiber', 'cava-nutrition'); ?></p><span id="total-fiber">0g</span></div>
                    </div>
                    <div class="summary-card sodium"><p><?php _e('Sodium', 'cava-nutrition'); ?></p><span id="total-sodium">0mg</span></div>
                    <div class="selections-list">
                        <h5><?php _e('Your Selections:', 'cava-nutrition'); ?></h5>
                        <ul id="selections-list"></ul>
                    </div>
                </aside>
            </div>
        </div>
    </section>

    <!-- Why Use Section -->
    <section class="why-use">
        <div class="container">
            <h2><?php _e('Why Use Our Cava Calorie Calculator?', 'cava-nutrition'); ?></h2>
            <p><?php _e('Are you trying to count Cava calories or wondering how many calories are in your Cava bowl? Our Cava calorie calculator makes it easy to:', 'cava-nutrition'); ?></p>
            <div class="features-grid">
                <div class="feature-item">
                    <div class="icon">📊</div>
                    <h3><?php _e('Calculate total calories', 'cava-nutrition'); ?></h3>
                    <p><?php _e('Get instant calorie counts as you build your bowl or pita', 'cava-nutrition'); ?></p>
                </div>
                <div class="feature-item">
                    <div class="icon">📈</div>
                    <h3><?php _e('Count carbs, protein, fat, and sodium', 'cava-nutrition'); ?></h3>
                    <p><?php _e('Track all macronutrients and key nutritional values', 'cava-nutrition'); ?></p>
                </div>
                <div class="feature-item">
                    <div class="icon">🔬</div>
                    <h3><?php _e('Analyze macro breakdowns', 'cava-nutrition'); ?></h3>
                    <p><?php _e('See detailed nutritional analysis for your custom meal', 'cava-nutrition'); ?></p>
                </div>
                <div class="feature-item">
                    <div class="icon">🎨</div>
                    <h3><?php _e('Customize every ingredient', 'cava-nutrition'); ?></h3>
                    <p><?php _e('Choose from bases, proteins, dips, toppings, and dressings', 'cava-nutrition'); ?></p>
                </div>
                <div class="feature-item">
                    <div class="icon">📄</div>
                    <h3><?php _e('Get real-time nutrition updates', 'cava-nutrition'); ?></h3>
                    <p><?php _e('See nutrition facts change instantly as you build', 'cava-nutrition'); ?></p>
                </div>
                <div class="feature-item">
                    <div class="icon">❤️</div>
                    <h3><?php _e('Make heart-healthy choices', 'cava-nutrition'); ?></h3>
                    <p><?php _e('Filter by dietary preferences: vegan, gluten free, and more', 'cava-nutrition'); ?></p>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
        <div class="container">
            <h2><?php _e('Ready to Build Your Perfect Cava Meal?', 'cava-nutrition'); ?></h2>
            <p><?php _e('Start using our nutrition calculator today and make informed choices about your Cava meals.', 'cava-nutrition'); ?></p>
            <button class="btn btn-light" onclick="document.getElementById('calculator-section').scrollIntoView({behavior: 'smooth'});">
                <?php _e('Launch Calculator Now →', 'cava-nutrition'); ?>
            </button>
        </div>
    </section>

    <?php
    // Display page content if exists
    if (have_posts()) {
        while (have_posts()) {
            the_post();
            the_content();
        }
    }
    ?>
</main>

<?php get_footer(); ?>
