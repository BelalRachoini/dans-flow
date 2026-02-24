
ALTER TABLE tickets DROP CONSTRAINT tickets_course_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_course_id_fkey 
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

ALTER TABLE tickets DROP CONSTRAINT tickets_source_course_id_fkey;
ALTER TABLE tickets ADD CONSTRAINT tickets_source_course_id_fkey 
  FOREIGN KEY (source_course_id) REFERENCES courses(id) ON DELETE SET NULL;
