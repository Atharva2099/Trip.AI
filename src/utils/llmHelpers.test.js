import { describe, it, expect } from 'vitest';
import { extractJson, validateAndAdjustCosts, buildPrompt } from './llmHelpers';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips ```json fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('strips plain ``` fences', () => {
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('extracts JSON embedded in prose', () => {
    expect(extractJson('Here you go: {"a":1} thanks!')).toEqual({ a: 1 });
  });

  it('returns null on garbage', () => {
    expect(extractJson('sorry I cannot help')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(extractJson('')).toBeNull();
    expect(extractJson(null)).toBeNull();
    expect(extractJson(undefined)).toBeNull();
  });
});

describe('validateAndAdjustCosts', () => {
  it('returns null costBreakdown when days is empty', () => {
    const result = validateAndAdjustCosts({ days: [] }, 2);
    expect(result.days).toEqual([]);
    expect(result.costBreakdown).toEqual({ activities: 0, food: 0, transportation: 0 });
    expect(result.perPersonTotal).toBe(0);
    expect(result.groupTotal).toBe(0);
  });

  it('sums activities, meals, and per-activity transport correctly', () => {
    const itinerary = {
      days: [
        {
          activities: [
            { name: 'A1', cost: 20, transport: { cost: 5 } },
            { name: 'A2', cost: 30, transport: { cost: 0 } }
          ],
          meals: [
            { name: 'M1', cost: 15 },
            { name: 'M2', cost: 25 }
          ]
        },
        {
          activities: [
            { name: 'A3', cost: 50, transport: { cost: 10 } }
          ],
          meals: [
            { name: 'M3', cost: 20 }
          ]
        }
      ]
    };
    const result = validateAndAdjustCosts(itinerary, 2);
    expect(result.costBreakdown.activities).toBe(100);   // 20 + 30 + 50
    expect(result.costBreakdown.food).toBe(60);           // 15 + 25 + 20
    expect(result.costBreakdown.transportation).toBe(15); // 5 + 0 + 10
    expect(result.perPersonTotal).toBe(175);              // 100 + 60 + 15
    expect(result.groupTotal).toBe(350);                  // 175 * 2
    expect(result.days[0].dailyTotal).toBe(95);           // 20+30+15+25+5+0
    expect(result.days[1].dailyTotal).toBe(80);           // 50+20+10
  });

  it('handles missing transport/activities/meals gracefully', () => {
    const itinerary = {
      days: [
        { activities: [{ name: 'A', cost: 10 }], meals: [] },
        { activities: [], meals: [{ name: 'M', cost: 5 }] },
        { activities: null, meals: null }
      ]
    };
    const result = validateAndAdjustCosts(itinerary, 1);
    expect(result.costBreakdown.activities).toBe(10);
    expect(result.costBreakdown.food).toBe(5);
    expect(result.costBreakdown.transportation).toBe(0);
    expect(result.perPersonTotal).toBe(15);
  });

  it('treats missing cost fields as zero', () => {
    const itinerary = {
      days: [
        { activities: [{ name: 'A' }, { name: 'B', cost: 10 }], meals: [{ name: 'M' }] }
      ]
    };
    const result = validateAndAdjustCosts(itinerary, 1);
    expect(result.costBreakdown.activities).toBe(10);
    expect(result.costBreakdown.food).toBe(0);
    expect(result.perPersonTotal).toBe(10);
  });
});

describe('buildPrompt', () => {
  const baseArgs = {
    destination: 'Lisbon',
    from: 'Berlin',
    dates: { start: '2025-09-01', end: '2025-09-05' },
    dayCount: 5,
    groupBudget: 3000,
    numPeople: 2,
    budgetPerPerson: 1500,
    formattedDates: ['2025-09-01', '2025-09-02', '2025-09-03', '2025-09-04', '2025-09-05'],
    interests: 'food, culture'
  };

  it('includes from and destination in the system prompt', () => {
    const { systemPrompt } = buildPrompt(baseArgs);
    expect(systemPrompt).toContain('Berlin');
    expect(systemPrompt).toContain('Lisbon');
  });

  it('includes distance rules', () => {
    const { systemPrompt } = buildPrompt(baseArgs);
    expect(systemPrompt).toContain('300–1500');
    expect(systemPrompt).toContain('flight');
    expect(systemPrompt).toContain('train');
  });

  it('includes geography overrides', () => {
    const { systemPrompt } = buildPrompt(baseArgs);
    expect(systemPrompt).toContain('Europe');
    expect(systemPrompt).toContain('Shinkansen');
    expect(systemPrompt).toContain('USA');
  });

  it('includes transport_to_destination and transport_back_home in the schema description', () => {
    const { systemPrompt } = buildPrompt(baseArgs);
    expect(systemPrompt).toContain('transport_to_destination');
    expect(systemPrompt).toContain('transport_back_home');
  });

  it('includes group budget in the budget rules', () => {
    const { systemPrompt } = buildPrompt(baseArgs);
    expect(systemPrompt).toContain('3000');
    expect(systemPrompt).toContain('2 people');
  });

  it('includes grounding context when provided', () => {
    const { systemPrompt } = buildPrompt({ ...baseArgs, groundingContext: 'WEB CONTEXT: top attraction is Belem Tower' });
    expect(systemPrompt).toContain('WEB CONTEXT');
    expect(systemPrompt).toContain('Belem Tower');
  });

  it('does not include empty grounding block when none provided', () => {
    const { systemPrompt } = buildPrompt(baseArgs);
    expect(systemPrompt).not.toContain('WEB CONTEXT');
  });

  it('user prompt includes all key trip details', () => {
    const { userPrompt } = buildPrompt(baseArgs);
    expect(userPrompt).toContain('Berlin');
    expect(userPrompt).toContain('Lisbon');
    expect(userPrompt).toContain('3000');
    expect(userPrompt).toContain('food, culture');
  });
});
