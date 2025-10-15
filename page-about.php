<?php
/**
 * Template Name: About
 * Description: Cava About Page
 */

if (!defined('ABSPATH')) exit;
get_header();
?>

<main id="main-content">
    <section class="about-page">
        <div class="container">
            <h1><?php _e('About Us', 'cava-nutrition'); ?></h1>
            <p class="subtitle"><?php _e('Your trusted companion for Cava nutrition tracking', 'cava-nutrition'); ?></p>
            
            <div class="about-content">
                <div class="mission-card">
                    <h3><?php _e('Our Mission', 'cava-nutrition'); ?></h3>
                    <p><?php _e('At Cava Nutrition Calculator, we believe that making healthy food choices shouldn\'t be complicated. Our mission is to provide an easy to use, accurate nutrition calculator that helps you understand exactly what goes into your Cava meals.', 'cava-nutrition'); ?></p>
                    <p><?php _e('Whether you\'re tracking calories, managing macros, or following specific dietary requirements, our calculator gives you the information you need to make informed decisions about your meals.', 'cava-nutrition'); ?></p>
                </div>
                
                <div class="values-grid">
                    <div class="value-card">
                        <div class="icon">🎯</div>
                        <h4><?php _e('Accuracy', 'cava-nutrition'); ?></h4>
                        <p><?php _e('We provide precise nutritional information based on official Cava data and nutritional guidelines.', 'cava-nutrition'); ?></p>
                    </div>
                    <div class="value-card">
                        <div class="icon">❤️</div>
                        <h4><?php _e('Health Focus', 'cava-nutrition'); ?></h4>
                        <p><?php _e('Empowering you to make informed, healthy choices that align with your dietary goals.', 'cava-nutrition'); ?></p>
                    </div>
                    <div class="value-card">
                        <div class="icon">👨‍💻</div>
                        <h4><?php _e('User-Friendly', 'cava-nutrition'); ?></h4>
                        <p><?php _e('Simple, intuitive interface designed for everyone, from nutrition beginners to experts.', 'cava-nutrition'); ?></p>
                    </div>
                    <div class="value-card">
                        <div class="icon">⚡️</div>
                        <h4><?php _e('Real-Time', 'cava-nutrition'); ?></h4>
                        <p><?php _e('Instant calculations and updates as you build your perfect Cava meal.', 'cava-nutrition'); ?></p>
                    </div>
                </div>
                
                <div class="disclaimer-card">
                    <h3><?php _e('Disclaimer', 'cava-nutrition'); ?></h3>
                    <p><?php _e('This is an independent nutrition calculator and is not affiliated with, endorsed by, or connected to Cava Grill. All nutritional information is compiled from publicly available sources and is provided for informational purposes only. For the most accurate and up-to-date nutritional information, please consult Cava\'s official nutrition resources.', 'cava-nutrition'); ?></p>
                </div>
            </div>
        </div>
    </section>
</main>

<?php get_footer(); ?>
