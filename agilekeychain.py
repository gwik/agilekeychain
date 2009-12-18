#! /usr/bin/env python
#
# Copyright (c) 2009 Antonin Amand <antonin.amand@gmail.com>
# 
# Permission to use, copy, modify, and distribute this software and its
# documentation for any purpose and without fee is hereby granted,
# provided that the above copyright notice appear in all copies and that
# both that copyright notice and this permission notice appear in
# supporting documentation.
# 
# THE AUTHOR PROVIDES THIS SOFTWARE ``AS IS'' AND ANY EXPRESSED OR 
# IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES 
# OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.  
# IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, 
# INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
# NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, 
# DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY 
# THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT 
# (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE 
# OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
#
# This module is a set of classes to decrypt and encrypt data using the 
# "AgileKeychain" format developed for 1Password by Agile Web Solutions, Inc.
# http://agilewebsolutions.com/products/1Password
# 
# Encryption keys are encrypted with the AES-CBC algorithm using a password 
# which is derived using the PBKDF2 algorithm and a salt to provide more safety.
#
# Data is then encrypted with encryption keys using the same AES-CBC algorithm.
#
# This module depends on hashlib and PyCrypto available on PyPi
# The implementation of the PBKDF2 algorithm distributed with this module
# is courtesy of Dwayne C. Litzenberger <dlitz@dlitz.net>

import hashlib
import os
try:
    import json
except ImportError:
    import simplejson as json

from PBKDF2 import PBKDF2
from RFC3369 import append_padding, remove_padding, PaddingProtocolError
from Crypto.Cipher import AES
from base64 import b64decode

try:
    from os import urandom as rand_function
except ImportError:
    from random import randint
    from struct import pack
    def rand_function(size):
        return "".join([pack("@H", randint(0, 0xffff))
                        for i in range(size / 2)])


class AgileKeychainError(StandardError): pass
class DecryptionFailure(AgileKeychainError): pass
class AgileKeychainOpenError(AgileKeychainError): pass

def s2a(string):
    return [ord(c) for c in string]

class Key(object):
    """ A Key in the keyring
    """

    SALTED_PREFIX = 'Salted__'
    ZERO_IV = "\0" * 16
    ITERATIONS = 1000
    BLOCK_SIZE = 16

    Nr = 14
    Nb = 4
    Nk = 8

    def __init__(self, identifier, level, data, validation):
        """ initialize key
        """
        self.identifier = identifier
        self.level = level
        self.validation = validation
        bin_data = data
        if self.__is_salted(bin_data):
            self.salt = bin_data[8:16]
            self.data = bin_data[16:]
        else:
            self.salt = self.ZERO_IV
            self.data = bin_data

        self.__decrypted_key = None

    def is_open(self):
        return not(self.__decrypted_key is None)

    def decrypt_key(self, password):
        """Decript the key using password

        The password is first derived using the PBKF2 algorithm then
        it decrypted using the AES-CBC algorithm
        """
        pbkdf2 = PBKDF2(password, self.salt, self.ITERATIONS)
        derived_key = pbkdf2.read(32)
        key = derived_key[:16]
        iv = derived_key[16:]
        cipher = AES.new(key, AES.MODE_CBC, iv)
        try:
            self.__decrypted_key = remove_padding(cipher.decrypt(self.data),
                AES.block_size)
        except PaddingProtocolError:
            raise DecryptionFailure, 'decryption failed for key %s' % \
                self.identifier
        self.__update_size(len(self.__decrypted_key) / 8)
        
        if not self.__validate_decripted_key():
            raise DecryptionFailure, 'decryption failed for key %s' % \
                self.identifier

    def decrypt(self, data):
        """Decrypt the data using AES-CBC algorithm

        The salt is automatically detected by looking for the SALTED_PREFIX
        at the beginning of the string.
        """
        if self.__is_salted(data):
            (key, iv) = self.__openssl_key(
                self.__decrypted_key, data[len(self.SALTED_PREFIX):16])
            data = data[16:]
        else:
            iv = self.ZERO_IV
            h = hashlib.md5()
            h.update(self.__decrypted_key)
            key = h.digest()

        # Todo add exception raise
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted_data = cipher.decrypt(data)
        return remove_padding(decrypted_data, AES.block_size)

    def encrypt(self, data):
        """Encrypt some data using AES-CBC algorithm
        """
        if self.__is_salted(data):
            salt = data[8:16]
            data = data[16:]
        else:
            salt = self.__make_salt(8)

        (key, iv) = self.__openssl_key(self.__decrypted_key, salt)
        cipher = AES.new(key, AES.MODE_CBC, iv)
        padding_size = (len(data) % self.BLOCK_SIZE)
        data = append_padding(data, AES.block_size)
        return self.SALTED_PREFIX + salt + cipher.encrypt(data)

    def close(self):
        del self.__decrypted_key

    def __make_salt(self, size):
        return rand_function(size)

    def __is_salted(self, data):
        return self.SALTED_PREFIX == data[:len(self.SALTED_PREFIX)]

    def __validate_decripted_key(self):
        data = self.decrypt(self.validation)
        res = data == self.__decrypted_key
        del data
        return res

    def __update_size(self, size):
        if size == 128:
            self.Nr = 10
            self.Nk = 4
        elif size == 192:
            self.Nr = 12
            self.Nk = 6
        elif size == 256:
            self.Nr = 14
            self.Nk = 8
        else:
            raise RuntimeError, "invalid key size"

    def __openssl_key(self, key, salt):
        """Generate an "openssl" key
        """
        data = key + salt
        hal = hashlib.md5()
        hal.update(data)
        h_data = hal.digest()
        if self.Nr >= 12: rounds = 3
        else: rounds = 2
        last_hash = h_data
        result = h_data
        for i in list(range(1, rounds)):
            hal = hashlib.md5()
            hal.update(last_hash + data)
            h = hal.digest()
            result = result + h
            last_hash = h
        k = result[:4 * self.Nk]
        iv = result[(4 * self.Nk):(4 * self.Nk + 16)]
        return (k, iv)

# Todo remove plist logic its not generic
class Keychain(object):
    """Manage the enc/dec key
    """

    def __init__(self):
        self.keys = list()

    def add_key(self, key):
        self.keys.append(key)

    def close(self):
        [ key.close() for key in self.keys ]

    def find_key_by_level(self, level):
        for key in self.keys:
            if key.level == level: return key
        return None

    def find_all_keys_by_level(self, level):
        return [k for k in self.keys if k.level == level]

    def find_key_by_id(self, id):
        for k in self.keys:
            if k.identifier == id:
                return k
        return None


class Entry(object):
    def __init__(self, keychain, properties):
        self.properties = properties
        self.keychain = keychain
        self.__is_loaded = False
        self.__key = None

    @property
    def uuid(self):
        self.properties['uuid']

    def decrypt(self):
        self.load()
        dec_js = self.__get_key().decrypt(
            b64decode(str(self.properties['encrypted'][:-1])))
        self.properties = json.loads(dec_js)

    def is_loaded(self):
        return self.__is_loaded

    def load(self):
        if not self.__is_loaded:
            self.properties = self.keychain._read_entry(self.uuid)
            self.__is_loaded = True

    def __get_key():
        self.load()
        if self.__key is None:
            self.__key = self.keychain.find_key_by_id(self.properties['keyID'])
        return self.__key


class AgileKeychain(Keychain):

    def __init__(self, path, name='default'):
        self.path = path
        self.name = name
        self.entries = None
        self.__open_keys_file()
        self.__read_entries_index()

    def __getitem__(self, uuid):
        return self.read_entry(uuid)

    def __repr__(self):
        return '<%s.AgileKeychain path="%s">' % (self.__module__, self.path)

    def entry_base(self):
        return os.path.join(self.path, 'data', self.name)

    def open(self, password):
        self.__decrypt_keys(password)
        del password

    def close(self):
        for k in self.__keys:
            del(k)
        for k, v in self.__index_by_uuid.items():
            del(v)
        self.__index_by_uuid.clear()

    def get_entry(uuid):
        return self.__index_by_uuid[uuid]

    def _read_entry(self, entry_uuid):
        entry_file_path = os.path.join(self.entry_base(),
                                       "%s.1password" % entry_uuid)
        file = open(entry_file_path, 'r')
        try:
            js = file.read()
        finally:
            file.close()
        entry = json.loads(js)
        return entry

    def __read_entries_index(self):
        entry_index_file = os.path.join(self.entry_base(), "contents.js")
        self.entries = list()
        self.__index_by_uuid = dict()
        fd = open(entry_index_file, 'r')
        try:
            index = json.loads(fd.read())
            for array in index:
                properties = dict()
                properties['uuid'] = array[0]
                properties['typeName'] = array[1]
                properties['title'] = array[2]
                properties['locationKey'] = array[3]
                properties['createdAt'] = array[4]
                entry = Entry(self, properties)
                self.__index_by_uuid = entry
                self.entries.append(entry)
        finally:
            fd.close()

    def __decrypt_keys(self, password):
        for k in self.keys:
            k.decrypt_key(password)

    def __open_keys_file(self):
        """Open the json file containing the keys for decrypting the
        real keychain and parse it
        """
        try:
            keys_file_path = \
                os.path.join(self.path, 'data', self.name, 'encryptionKeys.js')
            keys_file = open(keys_file_path, 'r')
            try:
                # seems that their is some \0 and the of base64 blobs
                # that makes expat parser fail
                # TODO: add some expat exception handling
                keys = json.loads(keys_file.read())
                self.keys = []
                for kd in keys['list']:
                    key = Key(kd['identifier'],
                              kd['level'],
                              b64decode(kd['data'][:-1]),
                              b64decode(kd['validation'][:-1]))
                    self.keys.append(key)
            finally:
                keys_file.close()
        except IOError, KeyError:
            raise AgileKeychainOpenError, 'error while opening the keychain'

if __name__ == '__main__':

    # import getpass
    # pwd = getpass.getpass('Password: ')
    pwd = "strongpassword"
    keychain = AgileKeychain("./test_data/test.agilekeychain")
    keychain.open(pwd)

    for entry in keychain.entries:
        print(" - %s (%s)" % (entry['title'], entry['uuid']))
        print keychain.decrypt_entry(entry['uuid'])
        print "-" * 80

    print keychain.decrypt_entry('379A9F9791EA4853B318111C0EEEC94F')

    key = keychain.keys[0]

    if key.decrypt(key.encrypt("1616161616161616")) != "1616161616161616":
        raise RuntimeError, "encdec failed"

    data_file = open("/usr/share/dict/words")
    data = data_file.read()
    key = keychain.find_key_by_level('SL5')

    encrypted = key.encrypt(data)
    decrypted = key.decrypt(encrypted)

    if not decrypted == data:
        raise RuntimeError, 'data should be the same'

# TODO :
#  - Key generation
#  - Key encryption
#  - Write Access
#  - add TESTS !

