/** DI token for the optional positions reader. Apps that have an org-units
 *  membership concept register a provider for this token; apps that don't
 *  just leave it unbound and every user row gets `positions: []`. */
export const USERS_POSITIONS_READER = 'USERS_POSITIONS_READER';
