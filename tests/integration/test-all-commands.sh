#!/bin/bash
# integration tests - requires the game to be running

PASS=0
FAIL=0

test_cmd() {
    local name="$1"
    local cmd="$2"
    local expect_success="$3"

    echo -n "  $name... "
    result=$(eval "$cmd" 2>/dev/null)

    if [ -z "$result" ]; then
        echo "FAIL (no response)"
        FAIL=$((FAIL+1))
        return
    fi

    success=$(echo "$result" | node -e "
      let d='';
      process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{
        try{console.log(JSON.parse(d).success)}
        catch{console.log('parse_error')}
      })
    ")

    if [ "$success" = "$expect_success" ]; then
        echo "PASS"
        PASS=$((PASS+1))
    else
        echo "FAIL (expected success=$expect_success, got $success)"
        echo "    $(echo "$result" | head -c 200)"
        echo ""
        FAIL=$((FAIL+1))
    fi
}

echo "=== Lumiterra CLI Integration Tests ==="
echo ""

echo "[query commands]"
test_cmd "query-status" "lumiterra query-status" "true"
test_cmd "query-inventory" "lumiterra query-inventory" "true"
test_cmd "query-recipes" "lumiterra query-recipes" "true"
test_cmd "query-recipes --recipe-id 301" "lumiterra query-recipes --recipe-id 301" "true"
test_cmd "query-recipes --craftable" "lumiterra query-recipes --craftable" "true"
test_cmd "query-recipes --include-locked" "lumiterra query-recipes --include-locked" "true"
test_cmd "query-recipes --level 1" "lumiterra query-recipes --level 1" "true"
test_cmd "query-recipes --talent-type battle" "lumiterra query-recipes --talent-type battle" "true"
test_cmd "query-near-entities" "lumiterra query-near-entities --type monster --radius 100 --limit 5" "true"
test_cmd "query-equipment" "lumiterra query-equipment" "true"
test_cmd "query-pets" "lumiterra query-pets" "true"
test_cmd "query-talent" "lumiterra query-talent" "true"
test_cmd "query-talent --talent-type battle" "lumiterra query-talent --talent-type battle" "true"
test_cmd "quest-list" "lumiterra quest-list" "true"
test_cmd "quest-list --type daily" "lumiterra quest-list --type daily" "true"

echo ""
echo "[error handling]"
test_cmd "unknown command" "lumiterra unknown-xxx" "false"
test_cmd "navigate (missing parameters)" "lumiterra navigate --x 100" "false"
test_cmd "navigate (complete parameters)" "lumiterra navigate --x 100 --y 0 --z 200" "true"
test_cmd "auto-combat (TODO)" "lumiterra auto-combat --timeout 3" "false"
test_cmd "use-item (missing parameters)" "lumiterra use-item" "false"
test_cmd "energy-manage (missing parameters)" "lumiterra energy-manage" "false"
test_cmd "equip (missing parameters)" "lumiterra equip" "false"
test_cmd "dismantle-equipment (missing parameters)" "lumiterra dismantle-equipment" "false"
test_cmd "pet-summon (missing parameters)" "lumiterra pet-summon --pet-id 1" "false"
test_cmd "capture-pet (missing parameters)" "lumiterra capture-pet" "false"
test_cmd "claim-pet (does not accept parameters)" "lumiterra claim-pet --egg-item-instance-id test" "false"
test_cmd "talent-manage (missing action)" "lumiterra talent-manage --talent-type battle --node-id 1" "false"
test_cmd "talent-manage (missing node-id)" "lumiterra talent-manage --action upgrade --talent-type battle" "false"
test_cmd "token-task-accept (missing task-id)" "lumiterra token-task-accept" "false"
test_cmd "token-task-claim (missing task-id)" "lumiterra token-task-claim" "false"
test_cmd "token-task-abandon (missing task-id)" "lumiterra token-task-abandon" "false"

echo ""
echo "[quest commands]"
test_cmd "quest-claim --type daily" "lumiterra quest-claim --type daily" "true"
test_cmd "quest-accept missing parameters" "lumiterra quest-accept --type daily" "false"

echo ""
echo "[return-to-town commands]"
test_cmd "back-to-town" "lumiterra back-to-town" "true"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
exit $FAIL
