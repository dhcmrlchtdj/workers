BEGIN;

CREATE TABLE credit (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    score INT NOT NULL,
    reason TEXT NOT NULL
);

COMMIT;

-- getScore(chat_id)
--  SELECT COALESCE(SUM(score), 0) FROM credit WHERE chat_id=$1

-- addScore(chat_id, message_id, score, reason)
--  INSERT INTO credit(chat_id, message_id, score, reason) VALUES ($1, $2, $3, $4)

-- deleteScore(chat_id, message_id)
--  DELETE FROM credit WHERE chat_id=$1 AND message_id=$2 RETURNING score, reason

-- getHistory(chat_id, limit)
--  SELECT created_at, score, reason
--  FROM credit
--  WHERE chat_id=$1
--  ORDER BY created_at DESC
--  LIMIT $2
