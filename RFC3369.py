""" This module implements PKCS#7/RFC3369 padding method

see http://www.di-mgt.com.au/cryptopad.html#aeslargerblocksize
"""

class PaddingProtocolError(StandardError): pass

def append_padding(data, block_size):
    """Add some padding to complete the last block

    Pad with bytes all of the same value as the number of padding bytes
    PKCS#7/RFC3369 method
    see: http://www.di-mgt.com.au/cryptopad.html#aeslargerblocksize

    The size of the padding is the number of bytes needed to complete
    the last block.
    The value of the padding bytes is the int corresponding to the
    size of the padding.
    """
    pad_len = block_size - (len(data) % block_size)
    return data + (chr(pad_len) * pad_len)

def remove_padding(data, block_size):
    """Remove padding from the decrypted data

    PKCS#7/RFC3369 method
    see: http://www.di-mgt.com.au/cryptopad.html#aeslargerblocksize
    """
    pad_chr = data[-1]
    pad_len = ord(pad_chr)
    if not pad_len in range(1, block_size + 1):
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
