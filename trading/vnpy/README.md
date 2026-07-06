# vn.py Integration Boundary

vn.py will own execution integration after signals are stable.

MVP boundary:

- No automatic live order placement.
- Backend signal output can later be converted into target positions.
- A vn.py adapter should consume reviewed target positions, not raw model scores.

Planned flow:

1. Qlib/backend generates daily stock pool and target weights.
2. UI shows proposed adjustments.
3. User confirms target positions.
4. vn.py paper-trading adapter submits orders.
5. Real broker gateway is enabled only after paper-trading validation.
