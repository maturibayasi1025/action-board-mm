-- eNPS 回答の更新で delete → insert するため、award_responses と同様に DELETE を許可する

CREATE POLICY "Users can delete their own enps responses"
    ON enps_responses FOR DELETE
    USING (auth.uid() = user_id);
