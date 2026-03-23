WITH ranked_assignments AS (
  SELECT
    a.user_id,
    ard.key,
    ROW_NUMBER() OVER (
      PARTITION BY a.user_id
      ORDER BY a.assigned_at DESC, a.created_at DESC, a.updated_at DESC
    ) AS row_number
  FROM assignments AS a
  INNER JOIN assignment_role_definitions AS ard
    ON ard.id = a.role_definition_id
  WHERE a.status <> 'CANCELLED'
)
UPDATE users AS u
SET operational_role = CASE
  WHEN ra.key = 'building_head' THEN 'HEAD'::"ProctorOperationalRole"
  WHEN ra.key = 'floor_senior' THEN 'SENIOR'::"ProctorOperationalRole"
  WHEN ra.key = 'roaming_monitor' THEN 'ROAMING'::"ProctorOperationalRole"
  WHEN ra.key IN ('room_proctor', 'assn_manual') THEN 'PROCTOR'::"ProctorOperationalRole"
  WHEN ra.key = 'control_room' THEN 'CONTROL'::"ProctorOperationalRole"
  WHEN ra.key IN ('service_support', 'service') THEN 'SERVICE'::"ProctorOperationalRole"
  ELSE u.operational_role
END
FROM ranked_assignments AS ra
WHERE ra.row_number = 1
  AND u.id = ra.user_id
  AND u.operational_role IS NULL;
