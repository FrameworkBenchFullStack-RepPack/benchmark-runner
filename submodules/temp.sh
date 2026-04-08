for dir in */; do
  [ -d "$dir" ] || continue
  echo "Checking $dir"
  if git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Updating $dir"
    git -C "$dir" switch main && git -C "$dir" pull
  fi
done
