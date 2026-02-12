/**
 * Declarative Net Request Conversion Module
 *
 * Purpose: Convert Redirector redirect rules to chrome.declarativeNetRequest format
 * MV3 Migration: Replacement for blocking webRequest API
 *
 * Created: 2025-12-23
 * MV3 Migration: Redirector v4.0.0
 */

// CODE ARCHAEOLOGY: MV3 Migration - New file
// Reason: MV3 requires declarativeNetRequest for request interception
// Original (MV2): webRequest with blocking returned {redirectUrl: ...}
// New (MV3): declarativeNetRequest with dynamic rules

/**
 * Convert Redirector rule to declarativeNetRequest rule format
 * @param {Object} redirectorRule - Redirector rule object
 * @param {number} ruleId - Unique rule ID (must be > 0)
 * @returns {Object|null} declarativeNetRequest rule or null if can't convert
 */
function convertToDeclarativeRule(redirectorRule, ruleId) {
	if (!redirectorRule || !redirectorRule.includePattern || !redirectorRule.redirectUrl) {
		return null;
	}

	// Skip disabled rules
	if (redirectorRule.disabled) {
		return null;
	}

	try {
		const resourceTypes = convertResourceTypes(redirectorRule.appliesTo);

		// Skip if no valid resource types
		if (!resourceTypes || resourceTypes.length === 0) {
			console.warn('Rule has no valid resource types, skipping:', redirectorRule);
			return null;
		}

		const rule = {
			id: ruleId,
			priority: 1,
			action: {
				type: 'redirect'
			},
			condition: {
				resourceTypes: resourceTypes
			}
		};

		// Convert pattern based on type
		let regexPattern;
		if (redirectorRule.patternType === 'W' || redirectorRule.patternType === 'wildcard') {
			// Wildcard pattern - convert to regex
			regexPattern = wildcardToRegex(redirectorRule.includePattern);
		} else {
			// Regex pattern
			regexPattern = redirectorRule.includePattern;
		}

		rule.condition.regexFilter = regexPattern;

		// Add exclude pattern if present
		if (redirectorRule.excludePattern && redirectorRule.excludePattern.trim() !== '') {
			rule.condition.excludedInitiatorDomains = [];
			rule.condition.excludedRequestDomains = [];
			// Note: excludePattern regex can't be directly converted to domain filters
			// This is a limitation - complex exclude patterns won't work
		}

		// Convert redirect URL
		// Check if redirect uses capture groups ($1, $2, etc.)
		const captureGroupMatches = redirectorRule.redirectUrl.match(/\$(\d+)/g);
		const hasCaptureGroups = captureGroupMatches && captureGroupMatches.length > 0;

		if (hasCaptureGroups) {
			// Count capture groups in the regex pattern
			let patternCaptureGroups = (regexPattern.match(/\((?!\?)/g) || []).length;
			const maxCaptureGroupUsed = Math.max(...captureGroupMatches.map(m => parseInt(m.substring(1))));

			// Auto-fix: if pattern needs more capture groups, wrap wildcards in groups
			if (maxCaptureGroupUsed > patternCaptureGroups) {
				console.log(`Auto-fixing pattern for rule "${redirectorRule.description}": adding capture groups`);
				console.log('Original pattern:', regexPattern);

				// Try to auto-fix by wrapping .* and .+ in capture groups
				let fixedPattern = regexPattern;
				let groupsNeeded = maxCaptureGroupUsed - patternCaptureGroups;

				// Wrap bare .* and .+ (not already in groups) with ()
				// This is a best-effort fix - may not work for all cases
				for (let i = 0; i < groupsNeeded; i++) {
					// Replace first occurrence of .* or .+ that's not in a group
					fixedPattern = fixedPattern.replace(/(\.\*|\.\+)(?![^\(]*\))/, '($1)');
				}

				regexPattern = fixedPattern;
				rule.condition.regexFilter = fixedPattern;
				console.log('Fixed pattern:', fixedPattern);
			}

			// Regex substitution redirect - convert $1, $2 to \1, \2
			const regexSubstitution = redirectorRule.redirectUrl.replace(/\$(\d+)/g, '\\$1');
			rule.action.redirect = {
				regexSubstitution: regexSubstitution
			};
		} else {
			// Static URL redirect (no capture groups)
			rule.action.redirect = {
				url: redirectorRule.redirectUrl
			};
		}

		// Check if it's a "Header Only" rule (redirecting to itself or same pattern)
		const isNoRedirect = redirectorRule.redirectUrl === redirectorRule.includePattern || 
							 redirectorRule.redirectUrl === '$0' ||
							 redirectorRule.redirectUrl === '$1' ||
							 (redirectorRule.patternType === 'R' && redirectorRule.redirectUrl === '$&');

		const rules = [];
		if (!isNoRedirect) {
			rules.push(rule);
		} else {
			console.log(`Rule "${redirectorRule.description}" is No-Redirect, skipping redirect part`);
		}

		// Add CORS headers rule if enabled
		if (redirectorRule.cors) {
			// If it's no-redirect, the condition should match the original site
			const filterUrl = isNoRedirect ? redirectorRule.includePattern : redirectorRule.redirectUrl;
			
			const corsRule = {
				id: ruleId + 1000000, 
				priority: 2, 
				action: {
					type: 'modifyHeaders',
					responseHeaders: [
						{ header: 'Access-Control-Allow-Origin', operation: 'set', value: '*' },
						{ header: 'Access-Control-Allow-Methods', operation: 'set', value: 'GET, POST, PUT, DELETE, OPTIONS' },
						{ header: 'Access-Control-Allow-Headers', operation: 'set', value: '*' },
						{ header: 'Content-Security-Policy', operation: 'remove' },
						{ header: 'X-Frame-Options', operation: 'remove' }
					]
				},
				condition: {
					// Match the target URL
					urlFilter: filterUrl.split('?')[0].replace(/\$(\d+)/g, '*'), 
					resourceTypes: resourceTypes
				}
			};

			// If regex rule and no-redirect, we might need a regexFilter instead of urlFilter
			if (isNoRedirect && redirectorRule.patternType === 'R') {
				delete corsRule.condition.urlFilter;
				corsRule.condition.regexFilter = filterUrl;
			}

			rules.push(corsRule);
		}

		return rules;

	} catch (error) {
		console.error('Failed to convert rule:', redirectorRule, error);
		return null;
	}
}

/**
 * Convert wildcard pattern to regex with capture groups
 * @param {string} wildcardPattern - Wildcard pattern with * and ?
 * @returns {string} Regex pattern with capture groups for *
 */
function wildcardToRegex(wildcardPattern) {
	// Escape special regex characters except * and ?
	let regex = wildcardPattern
		.replace(/[.+^${}()|[\]\\]/g, '\\$&')
		.replace(/\*/g, '(.*)')  // Wildcard * becomes capture group (.*)
		.replace(/\?/g, '.');    // Wildcard ? becomes single char .

	return '^' + regex + '$';
}

/**
 * Convert Redirector resource types to declarativeNetRequest resource types
 * @param {Array<string>} appliesTo - Redirector resource types
 * @returns {Array<string>} declarativeNetRequest resource types
 */
function convertResourceTypes(appliesTo) {
	if (!appliesTo || appliesTo.length === 0) {
		// Default to main_frame if not specified
		return ['main_frame'];
	}

	// Valid declarativeNetRequest resource types (from Chrome API)
	const validTypes = new Set([
		'main_frame',
		'sub_frame',
		'stylesheet',
		'script',
		'image',
		'font',
		'object',
		'xmlhttprequest',
		'ping',
		'csp_report',
		'media',
		'websocket',
		'webtransport',
		'webbundle',
		'other'
	]);

	const converted = appliesTo
		.map(type => type.toLowerCase())
		.filter(type => validTypes.has(type)); // Only keep valid types

	// If all types were filtered out (e.g., only 'history'), default to main_frame
	return converted.length > 0 ? converted : ['main_frame'];
}

/**
 * Convert all Redirector rules to declarativeNetRequest rules
 * @param {Array<Object>} redirectorRules - Array of Redirector rule objects
 * @returns {Array<Object>} Array of declarativeNetRequest rules
 */
function convertAllRules(redirectorRules) {
	if (!Array.isArray(redirectorRules)) {
		return [];
	}

	const declarativeRules = [];
	let ruleId = 1;

	for (const redirectorRule of redirectorRules) {
		// Skip disabled rules
		if (redirectorRule.disabled) {
			continue;
		}

		// Skip history type rules (handled by webNavigation)
		if (redirectorRule.appliesTo &&
		    redirectorRule.appliesTo.length === 1 &&
		    redirectorRule.appliesTo[0] === 'history') {
			continue;
		}

		const result = convertToDeclarativeRule(redirectorRule, ruleId);
		if (result) {
			if (Array.isArray(result)) {
				declarativeRules.push(...result);
			} else {
				declarativeRules.push(result);
			}
			ruleId++;
		}
	}

	return declarativeRules;
}

/**
 * Update declarativeNetRequest dynamic rules
 * @param {Array<Object>} redirectorRules - Array of Redirector rule objects
 * @returns {Promise<void>}
 */
async function updateDeclarativeRules(redirectorRules) {
	const declarativeRules = convertAllRules(redirectorRules);

	console.log('Updating declarativeNetRequest rules:', declarativeRules.length, 'rules');
	console.log('Declarative rules:', JSON.stringify(declarativeRules, null, 2));

	// Get current dynamic rules
	const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
	const currentRuleIds = currentRules.map(rule => rule.id);

	try {
		// Update rules: remove all old rules, add new ones
		await chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: currentRuleIds,
			addRules: declarativeRules
		});

		console.log('declarativeNetRequest rules updated successfully');
	} catch (error) {
		console.error('Failed to update declarativeNetRequest rules:', error);
		console.error('Failed rules:', JSON.stringify(declarativeRules, null, 2));
		throw error;
	}
}

// Export functions (if using modules)
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		convertToDeclarativeRule,
		convertAllRules,
		updateDeclarativeRules,
		wildcardToRegex,
		convertResourceTypes
	};
}
