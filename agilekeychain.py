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

class PaddingProtocolError(StandardError): pass
class AgileKeychainError(StandardError): pass
class DecryptionFailure(AgileKeychainError): pass
class AgileKeychainOpenError(AgileKeychainError): pass

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

    @classmethod
    def remove_padding(klass, data):
        """Remove padding from the decrypted data

        PKCS#7/RFC3369 method
        see: http://www.di-mgt.com.au/cryptopad.html#aeslargerblocksize        
        """
        pad_chr = data[-1]
        pad_len = ord(pad_chr)
        if not pad_len in range(1, klass.BLOCK_SIZE + 1):
            raise PaddingProtocolError, 'invalid padding size'
        c = 1
        for i in data[-pad_len:-1]:
            if i != pad_chr:
                raise PaddingProtocolError, \
                    'invalid padding data all bytes should be ' \
                    '%s bytes and byte #%d (last block) is %s' % \
                        (hex(pad_len), c, hex(ord(i)))
            c += 1
        return data[:-pad_len]

    @classmethod
    def append_padding(klass, data):
        """Add some padding to complete the last block

        Pad with bytes all of the same value as the number of padding bytes
        PKCS#7/RFC3369 method
        see: http://www.di-mgt.com.au/cryptopad.html#aeslargerblocksize

        The size of the padding is the number of bytes needed to complete
        the last block.
        The value of the padding bytes is the int corresponding to the
        size of the padding.
        """
        pad_len = klass.BLOCK_SIZE - (len(data) % klass.BLOCK_SIZE)
        return data + (chr(pad_len) * pad_len)

    def __init__(self, identifier, level, data, validation):
        """ initialize key

        data is supposed b64encoded
        """
        self.identifier = identifier
        self.level = level
        self.validation = b64decode(validation)
        bin_data = b64decode(data)
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
        self.__decrypted_key = self.remove_padding(cipher.decrypt(self.data))

        if not self.__validate_decripted_key():
            raise DecryptionFailure, 'decryption failed for key %s' % id
        self.__update_size(len(self.__decrypted_key))

    def decrypt(self, data):
        """Decrypt the data using AES-CBC algorithm

        The salt is automatically detected by looking for the SALTED_PREFIX
        at the beginning of the string.
        """
        if self.__is_salted(data):
            (key, iv) = self.__openssl_key(
                self.__decrypted_key, data[8:16])
            data = data[16:]
        else:
            iv = self.ZERO_IV
            h = hashlib.md5()
            h.update(self.__decrypted_key)
            key = h.digest()
        # Todo add exception raise
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted_data = cipher.decrypt(data)
        return self.remove_padding(decrypted_data)

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
        data = self.append_padding(data)
        return self.SALTED_PREFIX + salt + cipher.encrypt(data)

    def close(self):
        del self.__decrypted_key

    def __make_salt(self, size):
        return rand_function(size)

    def __is_salted(self, data):
        return self.SALTED_PREFIX == data[:8]

    def __validate_decripted_key(self):
        data = self.decrypt(self.validation)
        return data == self.__decrypted_key

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

class AgileKeychain(Keychain):

    name = 'default'

    def __init__(self, path):
        self.path = path
        self.entries = None
        self.__open_keys_file()
        self.__read_entries()

    def __getitem__(self, uuid):
        return self.read_entry(uuid)

    def entry_base(self):
        return os.path.join(self.path, 'data', self.name)

    def open(self, password):
        self.__decrypt_keys(password)
        del password

    def close(self):
        for k in self.__keys:
            del(k)
        
        del self.__keys
        
        for k, v in self.__index_by_uuid.items():
            del(v) 

    def decrypt_entry(self, entry_uuid):
        entry = self.read_entry(entry_uuid)
        key = self.find_key_by_id(entry['keyID'])
        dec_js = key.decrypt(b64decode(str(entry['encrypted'][:-1])))
        dec_entry = json.loads(dec_js)
        return dec_entry

    def read_entry(self, entry_uuid, force_reload=False):
        entry_from_index = self.__index_by_uuid[entry_uuid]
        if not(force_reload) and entry_from_index:
            return entry_from_index

        entry_file_path = os.path.join(self.entry_base(),
                                       "%s.1password" % entry_uuid)
        file = open(entry_file_path, 'r')
        try:
            js = file.read()
            entry = json.loads(js)
            self.__index_by_uuid[entry['uuid']] = entry
        finally:
            file.close()

    def __read_entries_index(self):
        entry_index_file = os.path.join(self.entry_base(), "contents.js")
        self.entries = list()
        self.__index_by_uuid = dict()
        fd = open(entry_index_file, 'r')
        try:
            index = json.loads(fd.read())
            for array in index:
                entry = dict()
                entry['uuid'] = array[0]
                entry['typeName'] = array[1]
                entry['title'] = array[2]
                entry['locationKey'] = array[3]
                entry['createdAt'] = array[4]
                self.__index_by_uuid[entry['uuid']] = entry
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
                    key = Key(identifier = str(kd['identifier']),
                              data = str(kd['data'][:-1]),
                              validation = str(kd['validation'][:-1]),
                              level = str(kd['level']))
                    self.keys.append(key)
            finally:
                keys_file.close()
        except IOError, KeyError:
            raise AgileKeychainOpenError, 'error while opening the keychain'

# if __name__ == '__main__':

#     import getpass
#     pwd = getpass.getpass('Password: ')
#     keychain = AgileKeychain("./tests/test.agilekeychain")
#     keychain.open(pwd)
#     for entry in keychain.entries:
#         print(" - %s (%s)" % (entry['title'], entry['uuid']))

#     print keychain.decrypt_entry('CD1D9656986C4415AF519F9DD346159D')

#     key = keychain.keys[0]

#     if key.decrypt(key.encrypt("1616161616161616")) != "1616161616161616":
#         raise RuntimeError, "encdec failed"

#     data_file = open("/usr/share/dict/words")
#     data = data_file.read()
#     key = key_ring.find_key_by_level('SL5')
#     key.decrypt_key(pwd)

#     encrypted = key.encrypt(data)
#     decrypted = key.decrypt(encrypted)

#     if not decrypted == data:
#         raise RuntimeError, 'data should be the same'

#    entry = key_ring.decrypt_entry("1Password.agilekeychain/data/default/"
#                                   "21769B1F47134DBC928BD06BE266CE5F.1password")
#    print(entry)

# TODO :
#  - Key generation
#  - Key encryption
#  - Write Access
#  - add TESTS !

