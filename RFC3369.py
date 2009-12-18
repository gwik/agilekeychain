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
""" This module implements PKCS#7/RFC3369 padding protocol

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
