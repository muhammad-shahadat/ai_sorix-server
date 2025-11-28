
-- 1. Users
-- CREATE TABLE users (
--     id BIGSERIAL PRIMARY KEY,
--     email VARCHAR(255) NOT NULL UNIQUE,
--     password_hash VARCHAR(255),
--     name VARCHAR(150) NOT NULL,
--     avatar_url VARCHAR(1024),
--     phone VARCHAR(20),
--     country VARCHAR(100),
--     role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
--     is_email_verified BOOLEAN NOT NULL DEFAULT false,
--     is_active BOOLEAN NOT NULL DEFAULT true,
--     _deleted BOOLEAN NOT NULL DEFAULT false,
--     deleted_at TIMESTAMP,
--     last_login_at TIMESTAMP,
--     preferences JSONB,
--     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE INDEX idx_users_email ON users(email);
-- CREATE INDEX idx_users_active ON users(is_active);
-- CREATE INDEX idx_users_deleted ON users(_deleted);

-- 2. Plans
-- CREATE TABLE plans (
--     id SERIAL PRIMARY KEY,
--     slug VARCHAR(50) NOT NULL UNIQUE,
--     title VARCHAR(100) NOT NULL,
--     description TEXT,
--     price_cents INTEGER NOT NULL DEFAULT 0,
--     billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
--     trial_days INTEGER NOT NULL DEFAULT 0,
--     messages_per_month INTEGER NOT NULL DEFAULT 0,
--     images_per_month INTEGER NOT NULL DEFAULT 0,
--     max_file_size_mb INTEGER NOT NULL DEFAULT 10,
--     max_chat_history_days INTEGER NOT NULL DEFAULT 90,
--     model_access JSONB NOT NULL DEFAULT '[]'::jsonb,
--     features JSONB,
--     is_active BOOLEAN NOT NULL DEFAULT true,
--     display_order INTEGER NOT NULL DEFAULT 0,
--     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );

-- 3. un used Subscriptions
-- CREATE TABLE subscriptions (
--     id BIGSERIAL PRIMARY KEY,
--     user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
--     plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
--     status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled','trialing','expired')),
--     current_period_start TIMESTAMP NOT NULL,
--     current_period_end TIMESTAMP NOT NULL,
--     trial_start TIMESTAMP,
--     trial_end TIMESTAMP,
--     cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
--     canceled_at TIMESTAMP,
--     external_subscription_id VARCHAR(255),
--     provider VARCHAR(100),
--     next_billing_date TIMESTAMP,
--     auto_renew BOOLEAN NOT NULL DEFAULT true,
--     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     UNIQUE (user_id)
-- );

-- -- এই ইনডেক্সগুলো যোগ করলে কোয়েরি সুপার ফাস্ট হবে
-- CREATE INDEX idx_subscriptions_active ON subscriptions(user_id) WHERE status = 'active';
-- CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);


--updated used subscription table --
--or--
-- Final Production-Ready Subscriptions Table (BD + Global + Error-Free)


-- CREATE TABLE subscriptions (
--     id BIGSERIAL PRIMARY KEY,
    
--     user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
--     plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,

--     -- সাবস্ক্রিপশনের স্ট্যাটাস
--     status VARCHAR(20) NOT NULL DEFAULT 'pending' 
--         CHECK (status IN (
--             'pending',      -- পেমেন্ট হয়নি / ওয়েটিং
--             'active',       -- চলছে (মূল স্টেট)
--             'trialing',     -- ফ্রি ট্রায়াল
--             'past_due',     -- পেমেন্ট ফেইল (Stripe)
--             'canceled',     -- ক্যানসেল করা
--             'expired',      -- মেয়াদ শেষ
--             'failed'        -- পেমেন্ট ফেইল (BD গেটওয়ে)
--         )),

--     -- পেমেন্ট প্রোভাইডার
--     provider VARCHAR(50) NOT NULL DEFAULT 'sslcommerz'
--         CHECK (provider IN ('sslcommerz', 'stripe', 'paddle', 'manual', 'bkash', 'nagad')),

--     -- এক্সটার্নাল আইডি
--     external_subscription_id VARCHAR(255),  -- Stripe: sub_xxx | SSLCommerz: val_id
--     external_customer_id VARCHAR(255),

--     -- BD পেমেন্টের জন্য খুবই জরুরি
--     payment_method VARCHAR(50),             -- 'bkash', 'nagad', 'rocket', 'card', 'mobile_banking'
--     transaction_id VARCHAR(255),            -- SSLCommerz: tran_id / bank_tran_id
--     amount_paid_cents BIGINT,               -- কত টাকা পেয়েছিস (cents এ, যেমন: 49900 = ৳499)
--     currency VARCHAR(10) DEFAULT 'BDT',

--     -- বিলিং পিরিয়ড
--     current_period_start TIMESTAMP,
--     current_period_end TIMESTAMP,
--     trial_start TIMESTAMP,
--     trial_end TIMESTAMP,

--     -- ক্যানসেলেশন
--     cancel_at_period_end BOOLEAN DEFAULT false,
--     canceled_at TIMESTAMP,

--     -- অটো রিনিউ
--     auto_renew BOOLEAN DEFAULT true,

--     -- এক্সট্রা ডাটা (পরে কাজে লাগবে)
--     metadata JSONB DEFAULT '{}'::jsonb,

--     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );

-- -- ==================== ইনডেক্স (সুপার ফাস্ট কোয়েরি) ====================
-- CREATE INDEX idx_subscriptions_user_id          ON subscriptions(user_id);
-- CREATE INDEX idx_subscriptions_plan_id          ON subscriptions(plan_id);
-- CREATE INDEX idx_subscriptions_status           ON subscriptions(status);
-- CREATE INDEX idx_subscriptions_provider         ON subscriptions(provider);
-- CREATE INDEX idx_subscriptions_period_end       ON subscriptions(current_period_end);
-- CREATE INDEX idx_subscriptions_transaction      ON subscriptions(transaction_id);
-- CREATE INDEX idx_subscriptions_external_id      ON subscriptions(external_subscription_id);

-- -- একজন ইউজারের একটাই active সাবস্ক্রিপশন থাকবে (খুবই জরুরি!)
-- CREATE UNIQUE INDEX idx_subscriptions_unique_active 
--     ON subscriptions(user_id) 
--     WHERE status = 'active';

-- -- active + trialing দুটোই একসাথে থাকতে পারবে না (অপশনাল, কিন্তু ভালো)
-- CREATE UNIQUE INDEX idx_subscriptions_unique_active_or_trialing 
--     ON subscriptions(user_id) 
--     WHERE status IN ('active', 'trialing');


-- 4. Payments
-- Payments Table (SSLCommerz + Future-Proof)
-- CREATE TABLE payments (
--     id BIGSERIAL PRIMARY KEY,
    
--     user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
--     subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
    
--     amount_cents INTEGER NOT NULL,                    -- 49900 = ৳499
--     currency CHAR(3) NOT NULL DEFAULT 'BDT',          -- শুধু BDT
--     status VARCHAR(20) NOT NULL DEFAULT 'pending'
--         CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    
--     provider VARCHAR(50) NOT NULL DEFAULT 'sslcommerz',
    
--     -- SSLCommerz এর গুরুত্বপূর্ণ আইডি
--     tran_id VARCHAR(255),                    -- আমরা যে tran_id পাঠাই (SORIX_xxx)
--     val_id VARCHAR(255) UNIQUE,              -- SSLCommerz এর ভেরিফাইড ID (এটাই আসল)
--     bank_tran_id VARCHAR(255),               -- ব্যাংক থেকে আসে (অপশনাল)
    
--     payment_method VARCHAR(50),              -- 'bkash', 'nagad', 'card', 'rocket'
--     card_type VARCHAR(50),                   -- 'VISA', 'bKash', 'Nagad'
    
--     error_message TEXT,
--     raw_response JSONB,                      -- পুরো ওয়েবহুক ডাটা সেভ করবি (ডিবাগের জন্য খুব কাজে লাগে)
    
--     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );

-- -- ইনডেক্স (সুপার ফাস্ট সার্চ)
-- CREATE INDEX idx_payments_user_id ON payments(user_id);
-- CREATE INDEX idx_payments_subscription_id ON payments(subscription_id);
-- CREATE INDEX idx_payments_status ON payments(status, created_at DESC);
-- CREATE INDEX idx_payments_tran_id ON payments(tran_id);
-- CREATE INDEX idx_payments_val_id ON payments(val_id);

--for second phase development coupons and  coupon_message.
-- 5. Coupons
-- CREATE TABLE coupons (
--     id SERIAL PRIMARY KEY,
--     code VARCHAR(50) NOT NULL UNIQUE,
--     type VARCHAR(20) NOT NULL CHECK (type IN ('percent', 'fixed')),
--     value_int INTEGER NOT NULL,
--     applies_to_plans JSONB,
--     max_uses INTEGER,
--     uses_count INTEGER NOT NULL DEFAULT 0,
--     expires_at TIMESTAMP,
--     is_active BOOLEAN NOT NULL DEFAULT true,
--     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );

-- -- 6. Coupon Usages
-- CREATE TABLE coupon_usages (
--     id BIGSERIAL PRIMARY KEY,
--     coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
--     user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     subscription_id BIGINT REFERENCES subscriptions(id),
--     used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     UNIQUE (user_id, coupon_id)
-- );

-- 7. Models
-- CREATE TABLE models (
--     id SERIAL PRIMARY KEY,
--     slug VARCHAR(100) NOT NULL UNIQUE,
--     provider VARCHAR(100) NOT NULL,
--     display_name VARCHAR(150) NOT NULL,
--     type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (type IN ('text','image','code','vision')),
--     api_endpoint VARCHAR(1024) NOT NULL,
--     max_tokens INTEGER NOT NULL DEFAULT 4096,
--     temperature_default NUMERIC(3,2) NOT NULL DEFAULT 0.7,
--     cost_per_1k_tokens NUMERIC(10,6) NOT NULL DEFAULT 0,
--     is_active BOOLEAN NOT NULL DEFAULT true,
--     priority INTEGER NOT NULL DEFAULT 0,
--     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
-- );

-- 8. Chats
CREATE TABLE chats (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(512),
    system_prompt TEXT,
    default_model_id INTEGER NOT NULL REFERENCES models(id),
    is_archived BOOLEAN NOT NULL DEFAULT false,
    _deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMP,
    total_messages INTEGER NOT NULL DEFAULT 0,
    total_tokens_used BIGINT NOT NULL DEFAULT 0,
    estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_chats_user ON chats(user_id, is_archived, _deleted);
CREATE INDEX idx_chats_last_message ON chats(last_message_at DESC);

-- 9. Messages - PARTITIONED + SUPER FAST
CREATE TABLE messages (
    id BIGSERIAL,
    chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    model_id INTEGER REFERENCES models(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    searchable_text TEXT GENERATED ALWAYS AS (
        TRIM(regexp_replace(regexp_replace(content, '<[^>]*>', '', 'g'), '[\r\n\t]+', ' ', 'g'))
    ) STORED,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    cost_cents INTEGER NOT NULL DEFAULT 0,
    attachments JSONB,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_messages_chat_created ON messages (chat_id, created_at DESC);
CREATE INDEX idx_messages_search ON messages USING GIN (to_tsvector('english', searchable_text));

-- Create 24 months partitions automatically
DO $$
DECLARE
    start_date DATE := date_trunc('month', CURRENT_DATE);
    current_month DATE := start_date;
BEGIN
    FOR i IN 0..23 LOOP
        EXECUTE format(
            'CREATE TABLE messages_y%1$s_m%2$s PARTITION OF messages 
             FOR VALUES FROM (%3$L) TO (%4$L)',
            to_char(current_month, 'YYYY'),
            to_char(current_month, 'MM'),
            current_month,
            current_month + INTERVAL '1 month'
        );
        current_month := current_month + INTERVAL '1 month';
    END LOOP;
END $$;

-- 10. Files
CREATE TABLE files (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id BIGINT REFERENCES chats(id) ON DELETE SET NULL,
    message_id BIGINT REFERENCES messages(id, created_at) ON DELETE SET NULL,
    storage_path VARCHAR(1024) NOT NULL,
    original_name VARCHAR(512) NOT NULL,
    mime_type VARCHAR(200) NOT NULL,
    size_bytes BIGINT NOT NULL,
    file_hash VARCHAR(64),
    virus_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (virus_status IN ('clean','pending','infected')),
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_files_user ON files(user_id);
CREATE INDEX idx_files_hash ON files(file_hash);

-- 11. Images
CREATE TABLE images (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id BIGINT REFERENCES chats(id) ON DELETE SET NULL,
    message_id BIGINT REFERENCES messages(id, created_at) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    provider VARCHAR(100) NOT NULL,
    provider_image_url VARCHAR(1024),
    local_storage_path VARCHAR(1024),
    width INTEGER NOT NULL DEFAULT 512,
    height INTEGER NOT NULL DEFAULT 512,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
    error_message TEXT,
    cost_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_images_user ON images(user_id, created_at DESC);

-- 12. Usage (Monthly Quota)
CREATE TABLE usage (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
    period_month VARCHAR(7) NOT NULL,
    messages_used INTEGER NOT NULL DEFAULT 0,
    images_generated INTEGER NOT NULL DEFAULT 0,
    tokens_used BIGINT NOT NULL DEFAULT 0,
    total_cost_cents INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, period_month)
);

-- 13. Rate Limits
CREATE TABLE rate_limits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(100) NOT NULL,
    window_start TIMESTAMP NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    max_requests INTEGER NOT NULL DEFAULT 60,
    is_exceeded BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, endpoint, window_start)
);

-- 14. Conversation Contexts
CREATE TABLE conversation_contexts (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    summary TEXT,
    summary_tokens INTEGER NOT NULL DEFAULT 0,
    messages_from_id BIGINT,
    messages_to_id BIGINT,
    context_version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_context_chat ON conversation_contexts(chat_id, is_active);

-- 15. Provider Keys
CREATE TABLE provider_keys (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(100) NOT NULL,
    key_name VARCHAR(150),
    encrypted_key TEXT NOT NULL,
    is_system_key BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_provider_keys ON provider_keys(provider);

-- 16. Webhook Events
CREATE TABLE webhook_events (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    payload TEXT NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMP,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_webhook_processed ON webhook_events(processed);

-- 17. Audit Logs
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id BIGINT,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success','failure')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- pg_cron - Auto partition + usage reset
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('monthly-auto-tasks', '0 0 1 * *', $$
    -- Create next month partition
    DO $$
    DECLARE next_month DATE := date_trunc('month', CURRENT_DATE + INTERVAL '1 month');
    BEGIN
        EXECUTE format('CREATE TABLE IF NOT EXISTS messages_y%1$s_m%2$s PARTITION OF messages FOR VALUES FROM (%3$L) TO (%4$L)',
            to_char(next_month, 'YYYY'), to_char(next_month, 'MM'), next_month, next_month + INTERVAL '1 month');
    END $$;

    -- Reset monthly usage
    INSERT INTO usage (user_id, period_month, messages_used, images_generated)
    SELECT id, to_char(CURRENT_DATE, 'YYYY-MM'), 0, 0 
    FROM users WHERE is_active = true AND _deleted = false
    ON CONFLICT (user_id, period_month) DO NOTHING;
$$);



--value insert manually--

-- Sorix Basic – Monthly Plan
INSERT INTO plans (
    slug, 
    title, 
    description, 
    price_cents, 
    billing_interval,
    trial_days,
    messages_per_month,
    images_per_month,
    max_file_size_mb,
    max_chat_history_days,
    model_access,
    features,
    is_active,
    display_order
) VALUES (
    'basic-monthly',
    'Sorix Basic',
    'Best for students & light users: ChatGPT + Gemini + DeepSeek, 300 images, unlimited messages/day – unbeatable value at just 499!',
    49900,                                    -- 499.00 BDT (cents এ)
    'monthly',
    1,                                        -- ট্রায়াল নাই
    -1,                                       -- Unlimited messages ( -1 = unlimited )
    300,                                      -- 300 images per month
    20,                                       -- Max 50MB file upload
    365,                                      -- 1 বছর পর্যন্ত চ্যাট হিস্ট্রি
    '["chatgpt", "gemini", "deepseek"]'::jsonb,
    '[
        "Unlimited text messages",
        "300 images per month",
        "Medium response speed",
        "20 saved projects",
        "PDF Q&A (up to 20 pages)",
        "Basic writing tools",
        "Safe mode AI (student friendly)",
        "Email support"
    ]'::jsonb,
    true,
    10                                         -- প্রাইসিং পেজে ক্রম
);

-- Sorix Basic – Yearly Plan (Discounted + 2 months free vibe)
INSERT INTO plans (
    slug, 
    title, 
    description, 
    price_cents, 
    billing_interval,
    trial_days,
    messages_per_month,
    images_per_month,
    max_file_size_mb,
    max_chat_history_days,
    model_access,
    features,
    is_active,
    display_order
) VALUES (
    'basic-yearly',
    'Sorix Basic (Yearly)',
    'Save BIG! Pay 4199/year instead of 5988 (499×12) – Get 2 months FREE + All Basic features',
    419900,                                   -- 4199.00 BDT
    'yearly',
    1,
    -1,                                       -- Unlimited messages
    300,                                      -- 300 images/month (same as monthly)
    20,
    365,
    '["chatgpt", "gemini", "deepseek"]'::jsonb,
    '[
        "Everything in Basic Monthly",
        "2 months completely FREE",
        "Best value for students",
        "Same 300 images/month",
        "Priority email support",
        "Safe & student-friendly AI"
    ]'::jsonb,
    true,
    11                                         -- মাসিকের পরে দেখাবে
);

