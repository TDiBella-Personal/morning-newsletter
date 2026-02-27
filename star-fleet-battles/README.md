# Star Fleet Battles

A browser-based tactical starship combat game inspired by Star Fleet Battles.

## How to Play

Open `index.html` in a browser. Each turn has three phases:

### 1. Energy Allocation (10 points)
- **Engines** — impulse steps available during movement
- **Shields** — recharges shields (up to 3 points per facing)
- **Weapons** — energy available to fire during combat

### 2. Movement
- **Forward** — move one hex in your current heading (costs 1 impulse)
- **Turn Left / Right** — rotate 45° (costs 1 impulse)
- End movement when done

### 3. Combat
- **Phasers** — any arc, range 1–8. Damage scales with weapon energy and range
- **Photon Torpedo** — forward arc only, range 1–10, 10 damage, costs 3 weapon energy + 1 torpedo

## Shields
Each ship has four shield facings: **Fore, Starboard, Aft, Port**. Damage hits the facing closest to the attack angle. Shields absorb damage before the hull takes hits.

## Win Condition
Reduce the enemy hull to 0.
