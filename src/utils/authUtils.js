import bcrypt from 'bcryptjs';

/**
 * Hashes a password using bcryptjs.
 * @param {string} password 
 * @returns {Promise<string>}
 */
export const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

/**
 * Verifies a password against a hash.
 * @param {string} password 
 * @param {string} hash 
 * @returns {Promise<boolean>}
 */
export const verifyPassword = async (password, hash) => {
    try {
        return await bcrypt.compare(password, hash);
    } catch (error) {
        console.error("Error verifying password:", error);
        return false;
    }
};

/**
 * Saves the last successful login data for offline access.
 * @param {string} username 
 * @param {string} password 
 * @param {Object} userData 
 * @param {string} token 
 */
export const saveLastAuth = async (username, password, userData, token) => {
    const passwordHash = await hashPassword(password);
    const lastAuth = {
        username,
        passwordHash,
        userData,
        token,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('last_auth', JSON.stringify(lastAuth));
};

/**
 * Retrieves the last successful login data.
 * @returns {Object|null}
 */
export const getLastAuth = () => {
    const data = localStorage.getItem('last_auth');
    return data ? JSON.parse(data) : null;
};
