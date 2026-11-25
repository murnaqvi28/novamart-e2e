const { BasePage } = require('../BasePage');

class AdminProductsPage extends BasePage {
  constructor(page) {
    super(page);
    this.root = page.getByTestId('admin-products');
    this.addButton = page.getByTestId('add-product');
    this.search = page.getByTestId('admin-product-search');
    this.rows = page.getByTestId('admin-product-row');
    this.modal = page.getByTestId('product-form-modal');
    this.submit = page.getByTestId('product-form-submit');
  }

  async goto() {
    await this.open('/admin/products');
    await this.rows.first().waitFor();
  }

  field(name) { return this.page.getByTestId(`product-form-${name}`); }
  fieldError(name) { return this.page.getByTestId(`product-form-error-${name}`); }

  row(name) {
    return this.rows.filter({ has: this.page.getByTestId('admin-product-name').filter({ hasText: name }) });
  }

  /** Fills the add/edit product form. Only provided fields are touched. */
  async fillForm({ name, description, price, compareAtPrice, stock, category, isFeatured, isActive }) {
    if (name !== undefined) await this.field('name').fill(name);
    if (description !== undefined) await this.field('description').fill(description);
    if (price !== undefined) await this.field('price').fill(String(price));
    if (compareAtPrice !== undefined) await this.field('compareAtPrice').fill(compareAtPrice === null ? '' : String(compareAtPrice));
    if (stock !== undefined) await this.field('stock').fill(String(stock));
    if (category !== undefined) await this.field('categoryId').selectOption({ label: category });
    if (isFeatured !== undefined) await this.field('isFeatured').setChecked(isFeatured);
    if (isActive !== undefined) await this.field('isActive').setChecked(isActive);
  }

  async createProduct(data) {
    await this.addButton.click();
    await this.fillForm(data);
    await this.submit.click();
  }

  async edit(name, changes) {
    await this.row(name).getByTestId('admin-product-edit').click();
    await this.fillForm(changes);
    await this.submit.click();
  }

  async deactivate(name) {
    this.acceptNextDialog();
    await this.row(name).getByTestId('admin-product-delete').click();
  }
}

module.exports = { AdminProductsPage };
