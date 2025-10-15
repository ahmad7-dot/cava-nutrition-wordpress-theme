<?php
/**
 * Template Name: Contact
 * Description: Cava Contact Page
 */

if (!defined('ABSPATH')) exit;
get_header();
?>

<main id="main-content">
    <section class="contact-page">
        <div class="container">
            <h1><?php _e('Contact Us', 'cava-nutrition'); ?></h1>
            <p class="subtitle"><?php _e('Have questions or feedback? We\'d love to hear from you. Fill out the form below and we\'ll get back to you soon.', 'cava-nutrition'); ?></p>
            
            <div class="contact-grid">
                <form class="contact-form" method="POST" id="contact-form">
                    <?php wp_nonce_field('cava_contact_form', 'cava_contact_nonce'); ?>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="name"><?php _e('Name', 'cava-nutrition'); ?></label>
                            <input type="text" id="name" name="name" required />
                        </div>
                        <div class="form-group">
                            <label for="email"><?php _e('Email', 'cava-nutrition'); ?></label>
                            <input type="email" id="email" name="email" required />
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="subject"><?php _e('Subject', 'cava-nutrition'); ?></label>
                        <input type="text" id="subject" name="subject" required />
                    </div>
                    <div class="form-group">
                        <label for="message"><?php _e('Message', 'cava-nutrition'); ?></label>
                        <textarea id="message" name="message" rows="6" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary"><?php _e('Send Message', 'cava-nutrition'); ?></button>
                </form>
                
                <div class="contact-info">
                    <h3><?php _e('Get in Touch', 'cava-nutrition'); ?></h3>
                    <div class="info-card">
                        <div class="info-icon">📧</div>
                        <div>
                            <h4><?php _e('Email', 'cava-nutrition'); ?></h4>
                            <p><a href="mailto:info@cavanutrition.com">info@cavanutrition.com</a></p>
                        </div>
                    </div>
                    <div class="info-card">
                        <div class="info-icon">📱</div>
                        <div>
                            <h4><?php _e('Phone', 'cava-nutrition'); ?></h4>
                            <p><a href="tel:+15551234567">+1 (555) 123-4567</a></p>
                            <small><?php _e('Mon-Fri, 9AM - 5PM PST', 'cava-nutrition'); ?></small>
                        </div>
                    </div>
                    <div class="info-card">
                        <div class="info-icon">📍</div>
                        <div>
                            <h4><?php _e('Location', 'cava-nutrition'); ?></h4>
                            <p>
                                <?php _e('123 Nutrition Avenue', 'cava-nutrition'); ?><br />
                                <?php _e('Healthy City, HC 12345', 'cava-nutrition'); ?><br />
                                <?php _e('United States', 'cava-nutrition'); ?>
                            </p>
                        </div>
                    </div>
                    <div class="info-card">
                        <div class="info-icon">💬</div>
                        <div>
                            <h4><?php _e('Social Media', 'cava-nutrition'); ?></h4>
                            <p>
                                <a href="#" target="_blank"><?php _e('Twitter/X', 'cava-nutrition'); ?></a>,
                                <a href="#" target="_blank"><?php _e('Facebook', 'cava-nutrition'); ?></a>,
                                <a href="#" target="_blank"><?php _e('Instagram', 'cava-nutrition'); ?></a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</main>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
            method: 'POST',
            body: new URLSearchParams({
                action: 'cava_contact_form',
                nonce: formData.get('cava_contact_nonce'),
                name: formData.get('name'),
                email: formData.get('email'),
                subject: formData.get('subject'),
                message: formData.get('message'),
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('<?php _e('Thank you! Your message has been sent.', 'cava-nutrition'); ?>');
                form.reset();
            } else {
                alert('<?php _e('Error sending message. Please try again.', 'cava-nutrition'); ?>');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('<?php _e('Error sending message.', 'cava-nutrition'); ?>');
        });
    });
});
</script>

<?php get_footer(); ?>
