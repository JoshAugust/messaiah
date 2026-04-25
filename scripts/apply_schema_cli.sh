#!/bin/bash
# Apply schema to Supabase using the CLI, statement by statement
# Handles function bodies with $$ delimiters properly

WORKSPACE="/Users/corgi12/.eragon-joshua_augustine/joshua_augustine_workspace/messaiah"
DB_URL="postgresql://postgres.xnwzvcfseuptqovyagom:n61TAmODoqJfZ5jD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
SQL_FILE="$WORKSPACE/scripts/schema.sql"
LOG="$WORKSPACE/scripts/schema_apply.log"

echo "=== Applying MESSAIAH schema ===" | tee "$LOG"
echo "Started: $(date)" | tee -a "$LOG"

# Use Python to split SQL properly (handles $$ function bodies)
python3 -c "
import re, sys

with open('$SQL_FILE') as f:
    sql = f.read()

# Remove comment-only lines
lines = []
for line in sql.split('\n'):
    stripped = line.strip()
    if stripped.startswith('--') and not stripped.startswith('-- ===='):
        continue
    lines.append(line)
sql = '\n'.join(lines)

# Split on semicolons but respect \$\$ blocks
blocks = []
current = ''
in_dollar = False

i = 0
while i < len(sql):
    c = sql[i]
    
    # Check for \$\$ delimiter
    if sql[i:i+2] == '\$\$':
        current += '\$\$'
        in_dollar = not in_dollar
        i += 2
        continue
    
    if c == ';' and not in_dollar:
        stmt = current.strip()
        if stmt and len(stmt) > 5:
            blocks.append(stmt + ';')
        current = ''
    else:
        current += c
    i += 1

# Write each statement to a numbered file
import os
out_dir = '$WORKSPACE/scripts/split'
os.makedirs(out_dir, exist_ok=True)

for idx, block in enumerate(blocks):
    # Skip pure comment blocks
    clean = '\n'.join(l for l in block.split('\n') if not l.strip().startswith('--')).strip()
    if not clean or clean == ';':
        continue
    with open(f'{out_dir}/{idx:03d}.sql', 'w') as f:
        f.write(block)
    
print(f'Split into {len(blocks)} statements')
" 2>&1

echo "" | tee -a "$LOG"

SUCCESS=0
FAILED=0
TOTAL=$(ls "$WORKSPACE/scripts/split/"*.sql 2>/dev/null | wc -l | tr -d ' ')

echo "Executing $TOTAL statements..." | tee -a "$LOG"

for f in "$WORKSPACE/scripts/split/"*.sql; do
    LABEL=$(head -1 "$f" | tr -d '\n' | cut -c1-60)
    RESULT=$(cd "$WORKSPACE" && npx supabase db query -f "$f" --db-url "$DB_URL" --output json 2>&1)
    
    if echo "$RESULT" | grep -q "error\|ERROR\|failed"; then
        echo "  ✗ $(basename $f): $LABEL" | tee -a "$LOG"
        echo "    $RESULT" | head -2 >> "$LOG"
        FAILED=$((FAILED + 1))
    else
        echo "  ✓ $(basename $f): $LABEL" | tee -a "$LOG"
        SUCCESS=$((SUCCESS + 1))
    fi
done

echo "" | tee -a "$LOG"
echo "Results: $SUCCESS succeeded, $FAILED failed out of $TOTAL" | tee -a "$LOG"
echo "Finished: $(date)" | tee -a "$LOG"
