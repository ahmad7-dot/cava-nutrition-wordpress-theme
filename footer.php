<?php
/**
 * Footer Template
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-col footer-about">
                    <a href="<?php echo esc_url(home_url('/')); ?>" class="site-logo">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 2H20C21.1 2 22 2.9 22 4V20C22 21.1 21.1 22 20 22H4C2.9 22 2 21.1 2 20V4C2 2.9 2.9 2 4 2ZM4 4V8H20V4H4ZM4 20H20V10H4V20Z" fill="#28a745"/>
                            <path d="M6 12H10V14H6V12ZM6 16H10V18H6V16ZM12 12H16V14H12V12ZM12 16H16V18H12V16Z" fill="#28a745"/>
                        </svg>
                        <span class="site-title">
                            <span class="logo-part-one">CavaNutrition</span><span class="logo-part-two">Calculator</span>
                        </span>
                    </a>
                    <p><?php bloginfo('description'); ?></p>
                    <div class="social-icons">
                        <a href="#" aria-label="Facebook">f</a>
                        <a href="#" aria-label="Twitter">𝕏</a>
                        <a href="#" aria-label="Instagram">📷</a>
                    </div>
                </div>
                
                <div class="footer-col footer-links">
                    <h4><?php _e('Quick Links', 'cava-nutrition'); ?></h4>
                    <ul>
                        <li><a href="<?php echo esc_url(home_url('/')); ?>"><?php _e('Home', 'cava-nutrition'); ?></a></li>
                        <li><a href="<?php echo esc_url(home_url('/menu')); ?>"><?php _e('Menu', 'cava-nutrition'); ?></a></li>
                        <li><a href="<?php echo esc_url(home_url('/about')); ?>"><?php _e('About', 'cava-nutrition'); ?></a></li>
                        <li><a href="<?php echo esc_url(home_url('/nutrition-database')); ?>"><?php _e('Nutrition Database', 'cava-nutrition'); ?></a></li>
                        <li><a href="<?php echo esc_url(home_url('/faq')); ?>"><?php _e('FAQ', 'cava-nutrition'); ?></a></li>
                        <li><a href="<?php echo esc_url(home_url('/contact')); ?>"><?php _e('Contact', 'cava-nutrition'); ?></a></li>
                    </ul>
                </div>
                
                <div class="footer-col footer-links">
                    <h4><?php _e('Legal', 'cava-nutrition'); ?></h4>
                    <ul>
                        <li><a href="#"><?php _e('Privacy Policy', 'cava-nutrition'); ?></a></li>
                        <li><a href="#"><?php _e('Terms of Service', 'cava-nutrition'); ?></a></li>
                        <li><a href="#"><?php _e('Cookie Policy', 'cava-nutrition'); ?></a></li>
                        <li><a href="#"><?php _e('Disclaimer', 'cava-nutrition'); ?></a></li>
                    </ul>
                </div>
            </div>
            
            <div class="footer-bottom">
                <p>&copy; <?php echo esc_html(date('Y')); ?> <?php bloginfo('name'); ?>. <?php _e('All Rights Reserved.', 'cava-nutrition'); ?></p>
            </div>
        </div>
    </footer>
    
    <?php wp_footer(); ?>
</body>
</html>
