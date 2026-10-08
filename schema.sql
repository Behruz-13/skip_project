-- СКИП — схема базы данных MySQL
-- Можно выполнить в phpMyAdmin. Приложение также создаёт таблицы автоматически при запуске.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  login VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(200) NOT NULL,
  position VARCHAR(200) DEFAULT '',
  role ENUM('superadmin','head','assistant','staff') NOT NULL,
  active TINYINT(1) DEFAULT 1,
  tg_chat_id VARCHAR(50) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  detail TEXT,
  basis VARCHAR(500) DEFAULT '',
  main_executor_id INT NOT NULL,
  priority ENUM('normal','high') DEFAULT 'normal',
  status ENUM('new','in_progress','review','closed') DEFAULT 'new',
  deadline DATETIME NOT NULL,
  created_by INT NOT NULL,
  is_self TINYINT(1) DEFAULT 0,
  self_type ENUM('personal','control') DEFAULT NULL,
  ext_requested TINYINT(1) DEFAULT 0,
  ext_new_deadline DATETIME DEFAULT NULL,
  ext_reason TEXT DEFAULT NULL,
  ext_requested_at DATETIME DEFAULT NULL,
  closed_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (main_executor_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS item_executors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  user_id INT NOT NULL,
  UNIQUE KEY (item_id, user_id),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  user_id INT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS acks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  user_id INT NOT NULL,
  ack_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (item_id, user_id),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS seen (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  user_id INT NOT NULL,
  seen_msg_id INT DEFAULT 0,
  UNIQUE KEY (item_id, user_id),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
