/**
 * NamingParser Unit Tests
 */

import { NamingParser, GTM_NAMING_TEMPLATES } from '../src';

describe('NamingParser', () => {
  let parser: NamingParser;

  beforeEach(() => {
    parser = new NamingParser();
  });

  describe('extractPattern', () => {
    it('should extract pattern from consistent names', () => {
      const names = [
        'GA4 - Homepage - Pageview',
        'GA4 - Product - Click',
        'GA4 - Cart - AddToCart'
      ];

      const pattern = parser.extractPattern(names);

      expect(pattern).not.toBeNull();
      expect(pattern?.separator).toBe(' - ');
      expect(pattern?.segments.length).toBe(3);
    });

    it('should return pattern with low confidence for inconsistent names', () => {
      const names = [
        'GA4_Homepage_Pageview',
        'Tag - Product Click',
        'random_name'
      ];

      const pattern = parser.extractPattern(names);

      // Should return a pattern but with low confidence
      expect(pattern?.confidence ?? 0).toBeLessThan(0.8);
    });

    it('should detect common separators', () => {
      const dashNames = ['CE - Click - Button', 'CE - Scroll - Page'];
      const underscoreNames = ['DLV_user_id', 'DLV_page_path'];

      const dashPattern = parser.extractPattern(dashNames);
      const underscorePattern = parser.extractPattern(underscoreNames);

      expect(dashPattern?.separator).toBe(' - ');
      expect(underscorePattern?.separator).toBe('_');
    });

    it('should handle single name', () => {
      const pattern = parser.extractPattern(['GA4 - Event - purchase']);

      expect(pattern).not.toBeNull();
      expect(pattern?.segments.length).toBeGreaterThan(0);
    });

    it('should return null for empty array', () => {
      const pattern = parser.extractPattern([]);

      expect(pattern).toBeNull();
    });
  });

  describe('generateName', () => {
    it('should generate name from pattern and variables', () => {
      const pattern = GTM_NAMING_TEMPLATES.TAG_GA4_EVENT;
      const variables = {
        event: 'purchase'
      };

      const name = parser.generateName(pattern, variables);

      expect(name).toBe('GA4 - Event - purchase');
    });

    it('should handle missing variables with placeholders', () => {
      const pattern = GTM_NAMING_TEMPLATES.TAG_GA4_EVENT;
      const variables = {}; // event is missing

      const name = parser.generateName(pattern, variables);

      expect(name).toContain('GA4');
      expect(name).toContain('Event');
      expect(name).toContain('{event}'); // placeholder
    });
  });

  describe('extractVariables', () => {
    it('should extract variables from name using pattern', () => {
      const pattern = GTM_NAMING_TEMPLATES.TRIGGER_CUSTOM_EVENT;
      const name = 'CE - purchase';

      const variables = parser.extractVariables(name, pattern);

      expect(variables).not.toBeNull();
      expect(variables?.event).toBe('purchase');
    });

    it('should return null for non-matching name', () => {
      const pattern = GTM_NAMING_TEMPLATES.TRIGGER_CUSTOM_EVENT;
      const name = 'Invalid Single Part';

      const variables = parser.extractVariables(name, pattern);

      expect(variables).toBeNull();
    });
  });

  describe('validate', () => {
    it('should validate name against pattern', () => {
      const pattern = GTM_NAMING_TEMPLATES.TAG_GA4_EVENT;

      const validResult = parser.validate('GA4 - Event - purchase', pattern);
      const invalidResult = parser.validate('Invalid', pattern);

      expect(validResult.valid).toBe(true);
      expect(invalidResult.valid).toBe(false);
    });

    it('should return issues for invalid names', () => {
      const pattern = GTM_NAMING_TEMPLATES.TAG_GA4_EVENT;
      const result = parser.validate('Wrong - Format', pattern);

      expect(result.valid).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues!.length).toBeGreaterThan(0);
    });

    it('should suggest correction for names with wrong segment count', () => {
      const pattern = GTM_NAMING_TEMPLATES.TAG_GA4_EVENT;  // Expects 3 segments
      const result = parser.validate('Only - Two', pattern);  // Only 2 segments

      expect(result.valid).toBe(false);
      // suggestedName is provided when segment count doesn't match
      expect(result.suggestedName).toBeDefined();
    });
  });

  describe('findBestPattern', () => {
    it('should find the best matching pattern', () => {
      const patterns = [
        GTM_NAMING_TEMPLATES.TAG_GA4_EVENT,
        GTM_NAMING_TEMPLATES.TRIGGER_CUSTOM_EVENT,
        GTM_NAMING_TEMPLATES.VARIABLE_DLV
      ];

      const best = parser.findBestPattern('CE - button_click', patterns);

      expect(best).toBe(GTM_NAMING_TEMPLATES.TRIGGER_CUSTOM_EVENT);
    });

    it('should return null when no pattern matches', () => {
      const patterns = [GTM_NAMING_TEMPLATES.TAG_GA4_EVENT];

      const best = parser.findBestPattern('completely_different_format', patterns);

      expect(best).toBeNull();
    });
  });

  describe('extractPatternsByPrefix', () => {
    it('should group names by prefix and extract patterns', () => {
      const names = [
        'GA4 - Page - View',
        'GA4 - Button - Click',
        'HTML - Custom Script',
        'HTML - Cookie Setter'
      ];

      const patterns = parser.extractPatternsByPrefix(names, ['GA4', 'HTML']);

      expect(patterns.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GTM_NAMING_TEMPLATES', () => {
    it('should have predefined templates', () => {
      expect(GTM_NAMING_TEMPLATES.TAG_GA4_EVENT).toBeDefined();
      expect(GTM_NAMING_TEMPLATES.TAG_GA4_CONFIG).toBeDefined();
      expect(GTM_NAMING_TEMPLATES.TRIGGER_CUSTOM_EVENT).toBeDefined();
      expect(GTM_NAMING_TEMPLATES.TRIGGER_CLICK).toBeDefined();
      expect(GTM_NAMING_TEMPLATES.VARIABLE_DLV).toBeDefined();
      expect(GTM_NAMING_TEMPLATES.VARIABLE_JS).toBeDefined();
      expect(GTM_NAMING_TEMPLATES.VARIABLE_CONST).toBeDefined();
    });

    it('should have consistent separator', () => {
      expect(GTM_NAMING_TEMPLATES.TAG_GA4_EVENT.separator).toBe(' - ');
      expect(GTM_NAMING_TEMPLATES.TRIGGER_CUSTOM_EVENT.separator).toBe(' - ');
      expect(GTM_NAMING_TEMPLATES.VARIABLE_DLV.separator).toBe(' - ');
    });

    it('should have valid segments', () => {
      const template = GTM_NAMING_TEMPLATES.TAG_GA4_EVENT;

      expect(template.segments.length).toBeGreaterThan(0);
      expect(template.segments[0].type).toBe('literal');
      expect(template.segments[0].value).toBe('GA4');
    });
  });
});
