-- إنشاء قاعدة البيانات مع دعم كامل للغة العربية والرموز التعبيرية
CREATE DATABASE IF NOT EXISTS `telecom_os_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `telecom_os_db`;

-- 1. جدول المحلات / الحسابات (Shops & Authentication)
CREATE TABLE IF NOT EXISTS `shops` (
  `id` VARCHAR(50) PRIMARY KEY,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(150) NOT NULL DEFAULT 'ZOLFA TECH',
  `subtitle` VARCHAR(150) NOT NULL DEFAULT 'OS TELECOM',
  `phone` VARCHAR(50) NOT NULL DEFAULT '78877026',
  `logo` LONGTEXT NULL,
  `exchange_rate` DECIMAL(12, 2) NOT NULL DEFAULT 89500.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. جدول المحافظ والصناديق (Wallets & Cash Sources)
CREATE TABLE IF NOT EXISTS `sources` (
  `id` VARCHAR(50) PRIMARY KEY,
  `shop_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `balance_usd` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `balance_lbp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sources_shop` (`shop_id`),
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. سجل حركات المحافظ التراكمي (Wallets Ledger)
CREATE TABLE IF NOT EXISTS `source_ledger` (
  `id` VARCHAR(50) PRIMARY KEY,
  `shop_id` VARCHAR(50) NOT NULL,
  `source_id` VARCHAR(50) NOT NULL,
  `type` ENUM('deposit', 'withdrawal', 'sale') NOT NULL,
  `item_name` VARCHAR(255) NULL,
  `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `balance_after_usd` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `balance_after_lbp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_ledger_shop_source` (`shop_id`, `source_id`),
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. جدول شرائح الرصيد (Recharge SIMs)
CREATE TABLE IF NOT EXISTS `sims` (
  `id` VARCHAR(50) PRIMARY KEY,
  `shop_id` VARCHAR(50) NOT NULL,
  `operator` ENUM('alfa', 'mtc') NOT NULL DEFAULT 'alfa',
  `name` VARCHAR(100) NOT NULL,
  `phone_number` VARCHAR(50) NULL,
  `balance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sims_shop` (`shop_id`),
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. جدول دفعات الشرائح (SIM Batches - FIFO Accounting)
CREATE TABLE IF NOT EXISTS `sim_batches` (
  `id` VARCHAR(50) PRIMARY KEY,
  `shop_id` VARCHAR(50) NOT NULL,
  `sim_id` VARCHAR(50) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `cycle_id` INT NULL,
  `amount_usd` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `remaining_usd` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `cost_price` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `cost_currency` VARCHAR(10) NOT NULL DEFAULT 'LBP',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_batches_shop_sim` (`shop_id`, `sim_id`),
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sim_id`) REFERENCES `sims`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. جدول الخطوط المسكرة (Locked Lines & Alfa Gift)
CREATE TABLE IF NOT EXISTS `locked_lines` (
  `id` VARCHAR(50) PRIMARY KEY,
  `shop_id` VARCHAR(50) NOT NULL,
  `slot_number` INT NOT NULL DEFAULT 1,
  `phone_number` VARCHAR(50) NOT NULL,
  `balance_usd` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `has_service` TINYINT(1) NOT NULL DEFAULT 0,
  `service_active` TINYINT(1) NOT NULL DEFAULT 0,
  `service_start_date` DATE NULL,
  `service_days` INT NOT NULL DEFAULT 30,
  `user1` VARCHAR(150) NULL,
  `user2` VARCHAR(150) NULL,
  `user3` VARCHAR(150) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_lines_shop` (`shop_id`),
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. جدول الديون والذمم (Debts: Customers, Merchants, Boxes)
CREATE TABLE IF NOT EXISTS `debts` (
  `id` VARCHAR(50) PRIMARY KEY,
  `shop_id` VARCHAR(50) NOT NULL,
  `category` ENUM('customers', 'merchants', 'boxes') NOT NULL DEFAULT 'customers',
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `original_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `due_date` DATE NULL,
  `paid` TINYINT(1) NOT NULL DEFAULT 0,
  `source_wallet_id` VARCHAR(50) NULL,
  `target_sim_id` VARCHAR(50) NULL,
  `target_line_id` VARCHAR(50) NULL,
  `cycle_id` INT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_debts_shop_cat` (`shop_id`, `category`),
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 8. كشف حساب الديون المتسلسل (Debt Payment History)
CREATE TABLE IF NOT EXISTS `debt_history` (
  `id` VARCHAR(50) PRIMARY KEY,
  `shop_id` VARCHAR(50) NOT NULL,
  `debt_id` VARCHAR(50) NOT NULL,
  `type` ENUM('debt', 'payment', 'full_payment', 'reopen') NOT NULL DEFAULT 'payment',
  `amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `remaining_after` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `notes` VARCHAR(255) NULL,
  `date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_dh_shop_debt` (`shop_id`, `debt_id`),
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. جدول الزبائن (Customers Registry)
CREATE TABLE IF NOT EXISTS `customers` (
  `id` VARCHAR(50) PRIMARY KEY,
  `shop_id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) NULL,
  `address` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_customers_shop` (`shop_id`),
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 10. سجل العمليات والمبيعات (Sales & Transactions Log)
CREATE TABLE IF NOT EXISTS `sales_history` (
  `id` VARCHAR(50) PRIMARY KEY,
  `shop_id` VARCHAR(50) NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'general_sale',
  `operator` VARCHAR(20) NULL,
  `title` VARCHAR(255) NULL,
  `item_name` VARCHAR(255) NOT NULL,
  `selling_price` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `cost_usd` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `profit_usd` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `customer_name` VARCHAR(150) NOT NULL DEFAULT 'عام',
  `customer_phone` VARCHAR(50) NULL,
  `is_debt` TINYINT(1) NOT NULL DEFAULT 0,
  `payment_type` VARCHAR(20) NOT NULL DEFAULT 'cash',
  `notes` TEXT NULL,
  `cycle_id` INT NULL,
  `date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_sales_shop_date` (`shop_id`, `date`),
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. جدول المصاريف (General Expenses)
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` VARCHAR(50) PRIMARY KEY,
  `shop_id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD',
  `source_wallet_id` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_expenses_shop` (`shop_id`),
  FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;