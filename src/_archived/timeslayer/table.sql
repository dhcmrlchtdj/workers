BEGIN;

CREATE TABLE credit (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    chatId BIGINT NOT NULL,
    messageId BIGINT NOT NULL,
    score INT NOT NULL,
    reason TEXT NOT NULL
);

COMMIT;

-- getScore(chatId)
--  SELECT COALESCE(SUM(score), 0) FROM credit WHERE chatId=$1

-- addScore(chatId, messageId, score, reason)
--  INSERT INTO credit(chatId, messageId, score, reason) VALUES ($1, $2, $3, $4)

-- deleteScore(chatId, messageId)
--  DELETE FROM credit WHERE chatId=$1 AND messageId=$2 RETURNING score, reason

-- updateReason(chatId, messageId, score, reason)
--  UPDATE credit SET score=$3, reason=$4 WHERE chatId=$1 AND messageId=$2

-- getHistory(chatId, limit)
--  SELECT createdAt, score, reason
--  FROM credit
--  WHERE chatId=$1
--  ORDER BY createdAt DESC
--  LIMIT $2
