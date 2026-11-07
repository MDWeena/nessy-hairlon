#!/bin/sh
# Builds the single-transaction apply scripts: ./build.sh <out-dir>
# Each output = pre-checks (BEGIN, snapshots) + the migration exactly as committed + post-checks (raise on
# any failure → whole transaction rolls back, then COMMIT).
set -eu
here=$(cd "$(dirname "$0")" && pwd); mig="$here/../../migrations"; out=${1:?out dir}
cat "$here/024_pre_checks.sql" "$mig/024_finances.sql" "$here/024_post_checks.sql" > "$out/apply024_checked.sql"
cat "$here/025_pre_checks.sql" "$mig/025_lock_down_anon_bookings.sql" "$here/025_post_checks.sql" > "$out/apply025_checked.sql"
echo "wrote $out/apply024_checked.sql $out/apply025_checked.sql"
