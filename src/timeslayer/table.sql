BEGIN;

CREATE TABLE credit (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    chat_id BIGINT NOT NULL UNIQUE,
    score INT NOT NULL,
    reason TEXT NOT NULL
);

COMMIT;

-- getScore(chat_id)
--  SELECT COALESCE(SUM(score), 0) FROM credit WHERE chat_id=$1

-- addScore(chat_id, score, reason)
--  INSERT INTO credit(chat_id, score, reason) VALUES ($1, $2, $3)

-- getHistory(chat_id, limit)
--  SELECT created_at, score, reason
--  FROM credit
--  WHERE chat_id=$1
--  ORDER BY created_at DESC
--  LIMIT $2
