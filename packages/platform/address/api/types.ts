/**
 * Flat object shape that an address form produces. Keys match the snake_case
 * column names (without any prefix) so that the same type describes each
 * individual address on an entity regardless of how many addresses it has.
 */
export interface AddressValue {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country_id?: string | null;
}
