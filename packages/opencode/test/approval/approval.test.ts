import { describe, expect, test } from "bun:test"
import { destructive, verdict } from "@/approval"

describe("destructive", () => {
  test("flags recursive force deletes", () => {
    expect(destructive("rm -rf node_modules")).toBe("recursive force delete")
    expect(destructive("rm -fr /tmp/build")).toBe("recursive force delete")
    expect(destructive("rm -r -f dist")).toBe("recursive force delete")
    expect(destructive("sudo rm --recursive --force /var/data")).toBe("recursive force delete")
  })

  test("does not flag plain deletes and reads", () => {
    expect(destructive("rm file.txt")).toBeUndefined()
    expect(destructive("rm -f lockfile")).toBeUndefined()
    expect(destructive("ls -la")).toBeUndefined()
    expect(destructive("git status")).toBeUndefined()
  })

  test("flags force pushes but allows force-with-lease", () => {
    expect(destructive("git push --force origin main")).toBe("remote force push")
    expect(destructive("git push -f")).toBe("remote force push")
    expect(destructive("git push --force-with-lease origin main")).toBeUndefined()
  })

  test("flags destructive git commands", () => {
    expect(destructive("git reset --hard HEAD~3")).toBe("hard reset")
    expect(destructive("git clean -fd")).toBe("forced git clean")
    expect(destructive("git branch -D feature")).toBe("forced branch delete")
    expect(destructive("git branch -d merged")).toBeUndefined()
  })

  test("flags destructive sql", () => {
    expect(destructive('psql -c "DROP TABLE users"')).toBe("destructive sql statement")
    expect(destructive('mysql -e "truncate table logs"')).toBe("destructive sql statement")
    expect(destructive('psql -c "DELETE FROM users"')).toBe("unfiltered sql delete")
    expect(destructive('psql -c "DELETE FROM users WHERE id = 1"')).toBeUndefined()
  })

  test("flags system-level destruction", () => {
    expect(destructive("mkfs.ext4 /dev/sda1")).toBe("filesystem format")
    expect(destructive("dd if=/dev/zero of=/dev/sda")).toBe("raw device write")
    expect(destructive("chmod -R 777 /srv")).toBe("world-writable permissions")
    expect(destructive("sudo reboot")).toBe("system power command")
    expect(destructive("echo done && shutdown -h now")).toBe("system power command")
  })
})

describe("verdict", () => {
  test("parses the last marker case-insensitively", () => {
    expect(verdict("Looks fine.\nVerdict: APPROVE")).toBe("approve")
    expect(verdict("Risky.\nverdict: reject")).toBe("reject")
    expect(verdict("Verdict: APPROVE\nOn reflection...\nVerdict: REJECT")).toBe("reject")
  })

  test("returns undefined when no marker is present", () => {
    expect(verdict("I am not sure about this one.")).toBeUndefined()
    expect(verdict("")).toBeUndefined()
  })
})
