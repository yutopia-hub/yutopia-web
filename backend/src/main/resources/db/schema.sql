-- YUTOPIA: Member, Place, Favorite schema
-- MySQL 8.0.16+
-- Reset only the YUTOPIA database, then recreate all application tables.
DROP DATABASE IF EXISTS yutopia;
CREATE DATABASE yutopia
    DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE yutopia;
SET NAMES utf8mb4;

-- 1. Member
CREATE TABLE IF NOT EXISTS members (
    member_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(254) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (member_id),
    UNIQUE KEY uk_members_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='회원';

-- 2. Region (hierarchical: city/province -> district)
CREATE TABLE IF NOT EXISTS regions (
    region_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parent_id BIGINT UNSIGNED NULL,
    region_name VARCHAR(100) NOT NULL,
    region_code VARCHAR(30) NULL,
    region_level TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (region_id),
    KEY idx_regions_parent (parent_id),
    CONSTRAINT fk_regions_parent FOREIGN KEY (parent_id)
        REFERENCES regions(region_id) ON DELETE RESTRICT,
    CONSTRAINT ck_regions_level CHECK (region_level IN (1, 2))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='시도 및 시군구';

-- 3. Place category (hierarchical)
CREATE TABLE IF NOT EXISTS place_categories (
    category_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    parent_id BIGINT UNSIGNED NULL,
    category_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (category_id),
    KEY idx_categories_parent (parent_id),
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id)
        REFERENCES place_categories(category_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='장소 카테고리';

-- 4. Place
CREATE TABLE IF NOT EXISTS places (
    place_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id BIGINT UNSIGNED NULL,
    region_id BIGINT UNSIGNED NULL,
    provider ENUM('TOUR_API', 'KAKAO', 'USER') NOT NULL,
    external_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    title VARCHAR(500) NOT NULL,
    address VARCHAR(500) NULL,
    detail_address VARCHAR(255) NULL,
    zipcode VARCHAR(10) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    place_url VARCHAR(2048) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (place_id),
    UNIQUE KEY uk_places_provider_external (provider, external_id),
    KEY idx_places_region_category (region_id, category_id),
    KEY idx_places_category (category_id),
    KEY idx_places_coords (latitude, longitude),
    CONSTRAINT fk_places_category FOREIGN KEY (category_id)
        REFERENCES place_categories(category_id) ON DELETE RESTRICT,
    CONSTRAINT fk_places_region FOREIGN KEY (region_id)
        REFERENCES regions(region_id) ON DELETE RESTRICT,
    CONSTRAINT ck_places_coords CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL AND
         latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='여행지 공통 정보';

-- 5. Place details (one-to-one, optional)
CREATE TABLE IF NOT EXISTS place_details (
    place_id BIGINT UNSIGNED NOT NULL,
    overview MEDIUMTEXT NULL,
    tel VARCHAR(100) NULL,
    homepage_url VARCHAR(2048) NULL,
    opening_hours TEXT NULL,
    closed_days VARCHAR(255) NULL,
    admission_fee TEXT NULL,
    parking_info TEXT NULL,
    pet_allowed BOOLEAN NULL,
    reservation_required BOOLEAN NULL,
    setting ENUM('INDOOR', 'OUTDOOR', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    intro_json JSON NULL,
    fetched_at DATETIME NULL,
    PRIMARY KEY (place_id),
    CONSTRAINT fk_details_place FOREIGN KEY (place_id)
        REFERENCES places(place_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='여행지 상세 정보';

-- 6. Place images (one-to-many)
CREATE TABLE IF NOT EXISTS place_images (
    image_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    place_id BIGINT UNSIGNED NOT NULL,
    image_url VARCHAR(2048) NOT NULL,
    thumbnail_url VARCHAR(2048) NULL,
    caption VARCHAR(255) NULL,
    source VARCHAR(150) NULL,
    license_type VARCHAR(30) NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    PRIMARY KEY (image_id),
    UNIQUE KEY uk_images_place_order (place_id, sort_order),
    CONSTRAINT fk_images_place FOREIGN KEY (place_id)
        REFERENCES places(place_id) ON DELETE CASCADE,
    CONSTRAINT ck_images_sort CHECK (sort_order >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='장소 이미지';

-- 7. Place tags (one-to-many, free-text tags)
CREATE TABLE IF NOT EXISTS place_tags (
    place_id BIGINT UNSIGNED NOT NULL,
    tag VARCHAR(50) NOT NULL,
    PRIMARY KEY (place_id, tag),
    KEY idx_place_tags_tag (tag),
    CONSTRAINT fk_tags_place FOREIGN KEY (place_id)
        REFERENCES places(place_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='장소 특징 태그';

-- 8. Favorites (member <-> place)
CREATE TABLE IF NOT EXISTS favorites (
    member_id BIGINT UNSIGNED NOT NULL,
    place_id BIGINT UNSIGNED NOT NULL,
    memo TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (member_id, place_id),
    KEY idx_favorites_place (place_id),
    CONSTRAINT fk_favorites_member FOREIGN KEY (member_id)
        REFERENCES members(member_id) ON DELETE CASCADE,
    CONSTRAINT fk_favorites_place FOREIGN KEY (place_id)
        REFERENCES places(place_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='회원의 찜 여행지';

-- Check created tables
SHOW TABLES;
