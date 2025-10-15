<?php
/**
 * Header Template
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
    <?php wp_body_open(); ?>
    
    <header class="header">
        <div class="container">
            <a href="<?php echo esc_url(home_url('/')); ?>" class="site-logo">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 2H20C21.1 2 22 2.9 22 4V20C22 21.1 21.1 22 20 22H4C2.9 22 2 21.1 2 20V4C2 2.9 2.9 2 4 2ZM4 4V8H20V4H4ZM4 20H20V10H4V20Z" fill="#28a745"/>
                    <path d="M6 12H10V14H6V12ZM6 16H10V18H6V16ZM12 12H16V14H12V12ZM12 16H16V18H12V16Z" fill="#28a745"/>
                </svg>
                <span class="site-title">
                    <span class="logo-part-one">CavaNutrition</span><span class="logo-part-two">Calculator</span>
                </span>
            </a>
            
            <nav class="main-navigation">
                <?php
                wp_nav_menu(array(
                    'theme_location' => 'primary',
                    'fallback_cb' => 'wp_page_menu',
                    'container' => false,
                ));
                ?>
            </nav>
        </div>
    </header>
