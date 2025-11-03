-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 01, 2025 at 04:48 AM
-- Server version: 11.8.3-MariaDB-log
-- PHP Version: 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sako`
--

-- --------------------------------------------------------

--
-- Table structure for table `attempt_answer`
--

CREATE TABLE `attempt_answer` (
  `id` char(36) NOT NULL,
  `attempt_id` char(36) NOT NULL,
  `question_id` char(36) NOT NULL,
  `option_id` char(36) DEFAULT NULL,
  `is_correct` tinyint(1) DEFAULT NULL,
  `answered_at` timestamp NULL DEFAULT NULL,
  `order_index` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `badge`
--

CREATE TABLE `badge` (
  `id` char(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `criteria_type` enum('level_100_percent','category_mastery','streak','points_total','custom') NOT NULL,
  `criteria_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`criteria_value`)),
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `favorit_video`
--

CREATE TABLE `favorit_video` (
  `id` char(36) NOT NULL,
  `id_user` char(36) NOT NULL,
  `id_video` char(36) NOT NULL,
  `tanggal_ditambah` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `level`
--

CREATE TABLE `level` (
  `id` char(36) NOT NULL,
  `category_id` char(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` text DEFAULT NULL,
  `time_limit_seconds` int(11) DEFAULT NULL CHECK (`time_limit_seconds` between 10 and 3600),
  `pass_condition_type` enum('percent_correct','points','time','custom') NOT NULL,
  `pass_threshold` decimal(5,2) NOT NULL,
  `base_xp` int(11) DEFAULT 0,
  `base_points` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `display_order` int(11) DEFAULT 0,
  `max_questions` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `prerequisite_level`
--

CREATE TABLE `prerequisite_level` (
  `id` char(36) NOT NULL,
  `level_id` char(36) NOT NULL,
  `required_level_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `qr_code`
--

CREATE TABLE `qr_code` (
  `id` char(36) NOT NULL,
  `tourist_place_id` char(36) NOT NULL,
  `code_value` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `question`
--

CREATE TABLE `question` (
  `id` char(36) NOT NULL,
  `level_id` char(36) NOT NULL,
  `text` text NOT NULL,
  `points_correct` int(11) DEFAULT 1,
  `points_wrong` int(11) DEFAULT 0,
  `display_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `question_option`
--

CREATE TABLE `question_option` (
  `id` char(36) NOT NULL,
  `question_id` char(36) NOT NULL,
  `label` varchar(4) NOT NULL,
  `text` text NOT NULL,
  `is_correct` tinyint(1) DEFAULT 0,
  `display_order` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `quiz_attempt`
--

CREATE TABLE `quiz_attempt` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `level_id` char(36) NOT NULL,
  `started_at` timestamp NULL DEFAULT current_timestamp(),
  `finished_at` timestamp NULL DEFAULT NULL,
  `duration_seconds` int(11) NOT NULL,
  `seed` int(11) NOT NULL,
  `total_questions` int(11) NOT NULL CHECK (`total_questions` >= 1),
  `status` enum('in_progress','submitted','expired','aborted') NOT NULL,
  `score_points` int(11) DEFAULT 0,
  `correct_count` int(11) DEFAULT 0,
  `wrong_count` int(11) DEFAULT 0,
  `unanswered_count` int(11) DEFAULT 0,
  `percent_correct` decimal(5,2) DEFAULT 0.00,
  `metadata_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata_snapshot`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `quiz_category`
--

CREATE TABLE `quiz_category` (
  `id` char(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `display_order` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `review`
--

CREATE TABLE `review` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `tourist_place_id` char(36) NOT NULL,
  `rating` int(11) DEFAULT NULL CHECK (`rating` between 1 and 5),
  `review_text` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tourist_place`
--

CREATE TABLE `tourist_place` (
  `id` char(36) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `location_lat` decimal(9,6) NOT NULL,
  `location_lng` decimal(9,6) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` char(36) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `total_xp` int(11) DEFAULT 0,
  `status` enum('active','inactive','banned') DEFAULT 'active',
  `user_image_url` varchar(512) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_badge`
--

CREATE TABLE `user_badge` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `badge_id` char(36) NOT NULL,
  `earned_at` timestamp NULL DEFAULT current_timestamp(),
  `source_level_id` char(36) DEFAULT NULL,
  `source_category_id` char(36) DEFAULT NULL,
  `attempt_id` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_category_progress`
--

CREATE TABLE `user_category_progress` (
  `user_id` char(36) NOT NULL,
  `category_id` char(36) NOT NULL,
  `percent_completed` decimal(5,2) DEFAULT 0.00,
  `completed_levels_count` int(11) DEFAULT 0,
  `total_levels_count` int(11) DEFAULT 0,
  `last_updated_at` timestamp NULL DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_level_progress`
--

CREATE TABLE `user_level_progress` (
  `user_id` char(36) NOT NULL,
  `level_id` char(36) NOT NULL,
  `best_percent_correct` decimal(5,2) DEFAULT 0.00,
  `best_score_points` int(11) DEFAULT 0,
  `total_attempts` int(11) DEFAULT 0,
  `status` enum('locked','unstarted','in_progress','completed') DEFAULT 'locked',
  `last_attempt_id` char(36) DEFAULT NULL,
  `last_updated_at` timestamp NULL DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_points`
--

CREATE TABLE `user_points` (
  `user_id` char(36) NOT NULL,
  `total_points` int(11) DEFAULT 0,
  `lifetime_points` int(11) DEFAULT 0,
  `last_updated_at` timestamp NULL DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_visit`
--

CREATE TABLE `user_visit` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `tourist_place_id` char(36) NOT NULL,
  `status` enum('visited','not_visited') DEFAULT 'not_visited',
  `visited_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `video`
--

CREATE TABLE `video` (
  `id` char(36) NOT NULL,
  `judul` varchar(150) NOT NULL,
  `kategori` enum('Kesenian','Kuliner','Adat','Wisata') NOT NULL,
  `youtube_url` varchar(512) NOT NULL,
  `thumbnail_url` varchar(512) DEFAULT NULL,
  `deskripsi` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `attempt_answer`
--
ALTER TABLE `attempt_answer`
  ADD PRIMARY KEY (`id`),
  ADD KEY `attempt_id` (`attempt_id`),
  ADD KEY `question_id` (`question_id`),
  ADD KEY `option_id` (`option_id`);

--
-- Indexes for table `badge`
--
ALTER TABLE `badge`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `favorit_video`
--
ALTER TABLE `favorit_video`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id_user` (`id_user`,`id_video`),
  ADD KEY `id_video` (`id_video`);

--
-- Indexes for table `level`
--
ALTER TABLE `level`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `prerequisite_level`
--
ALTER TABLE `prerequisite_level`
  ADD PRIMARY KEY (`id`),
  ADD KEY `level_id` (`level_id`),
  ADD KEY `required_level_id` (`required_level_id`);

--
-- Indexes for table `qr_code`
--
ALTER TABLE `qr_code`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code_value` (`code_value`),
  ADD KEY `tourist_place_id` (`tourist_place_id`);

--
-- Indexes for table `question`
--
ALTER TABLE `question`
  ADD PRIMARY KEY (`id`),
  ADD KEY `level_id` (`level_id`);

--
-- Indexes for table `question_option`
--
ALTER TABLE `question_option`
  ADD PRIMARY KEY (`id`),
  ADD KEY `question_id` (`question_id`);

--
-- Indexes for table `quiz_attempt`
--
ALTER TABLE `quiz_attempt`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `level_id` (`level_id`);

--
-- Indexes for table `quiz_category`
--
ALTER TABLE `quiz_category`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `review`
--
ALTER TABLE `review`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `tourist_place_id` (`tourist_place_id`);

--
-- Indexes for table `tourist_place`
--
ALTER TABLE `tourist_place`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `user_badge`
--
ALTER TABLE `user_badge`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `badge_id` (`badge_id`),
  ADD KEY `source_level_id` (`source_level_id`),
  ADD KEY `source_category_id` (`source_category_id`),
  ADD KEY `attempt_id` (`attempt_id`);

--
-- Indexes for table `user_category_progress`
--
ALTER TABLE `user_category_progress`
  ADD PRIMARY KEY (`user_id`,`category_id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `user_level_progress`
--
ALTER TABLE `user_level_progress`
  ADD PRIMARY KEY (`user_id`,`level_id`),
  ADD KEY `level_id` (`level_id`),
  ADD KEY `last_attempt_id` (`last_attempt_id`);

--
-- Indexes for table `user_points`
--
ALTER TABLE `user_points`
  ADD PRIMARY KEY (`user_id`);

--
-- Indexes for table `user_visit`
--
ALTER TABLE `user_visit`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`,`tourist_place_id`),
  ADD KEY `tourist_place_id` (`tourist_place_id`);

--
-- Indexes for table `video`
--
ALTER TABLE `video`
  ADD PRIMARY KEY (`id`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `attempt_answer`
--
ALTER TABLE `attempt_answer`
  ADD CONSTRAINT `attempt_answer_ibfk_1` FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempt` (`id`),
  ADD CONSTRAINT `attempt_answer_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `question` (`id`),
  ADD CONSTRAINT `attempt_answer_ibfk_3` FOREIGN KEY (`option_id`) REFERENCES `question_option` (`id`);

--
-- Constraints for table `favorit_video`
--
ALTER TABLE `favorit_video`
  ADD CONSTRAINT `favorit_video_ibfk_1` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `favorit_video_ibfk_2` FOREIGN KEY (`id_video`) REFERENCES `video` (`id`);

--
-- Constraints for table `level`
--
ALTER TABLE `level`
  ADD CONSTRAINT `level_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `quiz_category` (`id`);

--
-- Constraints for table `prerequisite_level`
--
ALTER TABLE `prerequisite_level`
  ADD CONSTRAINT `prerequisite_level_ibfk_1` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`),
  ADD CONSTRAINT `prerequisite_level_ibfk_2` FOREIGN KEY (`required_level_id`) REFERENCES `level` (`id`);

--
-- Constraints for table `qr_code`
--
ALTER TABLE `qr_code`
  ADD CONSTRAINT `qr_code_ibfk_1` FOREIGN KEY (`tourist_place_id`) REFERENCES `tourist_place` (`id`);

--
-- Constraints for table `question`
--
ALTER TABLE `question`
  ADD CONSTRAINT `question_ibfk_1` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`);

--
-- Constraints for table `question_option`
--
ALTER TABLE `question_option`
  ADD CONSTRAINT `question_option_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `question` (`id`);

--
-- Constraints for table `quiz_attempt`
--
ALTER TABLE `quiz_attempt`
  ADD CONSTRAINT `quiz_attempt_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `quiz_attempt_ibfk_2` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`);

--
-- Constraints for table `review`
--
ALTER TABLE `review`
  ADD CONSTRAINT `review_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `review_ibfk_2` FOREIGN KEY (`tourist_place_id`) REFERENCES `tourist_place` (`id`);

--
-- Constraints for table `user_badge`
--
ALTER TABLE `user_badge`
  ADD CONSTRAINT `user_badge_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `user_badge_ibfk_2` FOREIGN KEY (`badge_id`) REFERENCES `badge` (`id`),
  ADD CONSTRAINT `user_badge_ibfk_3` FOREIGN KEY (`source_level_id`) REFERENCES `level` (`id`),
  ADD CONSTRAINT `user_badge_ibfk_4` FOREIGN KEY (`source_category_id`) REFERENCES `quiz_category` (`id`),
  ADD CONSTRAINT `user_badge_ibfk_5` FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempt` (`id`);

--
-- Constraints for table `user_category_progress`
--
ALTER TABLE `user_category_progress`
  ADD CONSTRAINT `user_category_progress_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `user_category_progress_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `quiz_category` (`id`);

--
-- Constraints for table `user_level_progress`
--
ALTER TABLE `user_level_progress`
  ADD CONSTRAINT `user_level_progress_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `user_level_progress_ibfk_2` FOREIGN KEY (`level_id`) REFERENCES `level` (`id`),
  ADD CONSTRAINT `user_level_progress_ibfk_3` FOREIGN KEY (`last_attempt_id`) REFERENCES `quiz_attempt` (`id`);

--
-- Constraints for table `user_points`
--
ALTER TABLE `user_points`
  ADD CONSTRAINT `user_points_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `user_visit`
--
ALTER TABLE `user_visit`
  ADD CONSTRAINT `user_visit_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `user_visit_ibfk_2` FOREIGN KEY (`tourist_place_id`) REFERENCES `tourist_place` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
