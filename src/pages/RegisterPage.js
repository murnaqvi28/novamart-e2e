const { BasePage } = require('./BasePage');

class RegisterPage extends BasePage {
  constructor(page) {
    super(page);
    this.name = page.getByTestId('register-name');
    this.email = page.getByTestId('register-email');
    this.password = page.getByTestId('register-password');
    this.confirm = page.getByTestId('register-confirm');
    this.submit = page.getByTestId('register-submit');
    this.error = page.getByTestId('register-error');
  }

  async goto() {
    await this.open('/register');
  }

  fieldError(field) {
    return this.page.getByTestId(`register-error-${field}`);
  }

  async register({ name, email, password, confirm }) {
    await this.name.fill(name);
    await this.email.fill(email);
    await this.password.fill(password);
    await this.confirm.fill(confirm ?? password);
    await this.submit.click();
  }
}

module.exports = { RegisterPage };
